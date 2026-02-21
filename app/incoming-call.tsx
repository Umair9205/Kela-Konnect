import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  PermissionsAndroid, Platform,
  StyleSheet, Text, TouchableOpacity,
  Vibration,
  View
} from 'react-native';
import AudioStream from '../modules/AudioStream';
import WifiDirect from '../modules/WifiDirect';
import { signalingManager } from '../services/CallSignaling';
import { useAppStore } from '../store/appStore';

type CallState = 'ringing' | 'connecting' | 'active' | 'ended';

export default function IncomingCallScreen() {
  const { callerId, callerName, callerMac } = useLocalSearchParams<{
    callerId: string;   // caller's permanent UUID
    callerName: string;
    callerMac: string;  // caller's current BLE MAC
  }>();

  const myUUID = useAppStore(state => state.myUUID);
  const myDeviceName = useAppStore(state => state.myDeviceName);

  const [callState, setCallState] = useState<CallState>('ringing');
  const [statusText, setStatusText] = useState(`${callerName} is calling...`);
  const [callDuration, setCallDuration] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const callStartRef = useRef<number>(0);
  const cleanedUp = useRef(false);

  useEffect(() => {
    Vibration.vibrate([500, 500, 500, 500], true);

    // Listen for caller ending/cancelling while ringing
    const handleEnd = ({ signal }: any) => {
      if (signal.from !== callerId) return;
      Vibration.cancel();
      cleanup();
      router.back();
    };
    signalingManager.on('call-end', handleEnd);

    return () => {
      Vibration.cancel();
      signalingManager.off('call-end', handleEnd);
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (callState === 'active') {
      callStartRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartRef.current) / 1000));
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callState]);

  const acceptCall = async () => {
    try {
      Vibration.cancel();
      setCallState('connecting');
      setStatusText('Connecting...');

      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          rejectCall();
          return;
        }
      }

      // Set up listener for credentials BEFORE sending accept
      // Caller sends credentials in a second 'call-accept' message after receiving our accept
      const handleCredentials = async ({ signal }: any) => {
        if (signal.from !== callerId) return;
        if (!signal.data?.isCredentials) return;  // ignore our own accept echo
        signalingManager.off('call-accept', handleCredentials);

        const { ssid, passphrase } = signal.data;
        console.log(`📶 Got WiFi credentials: ${ssid}`);
        setStatusText('Joining audio channel...');

        // Listen for audio ready
        const audioSub = WifiDirect.onAudioReady(() => {
          audioSub.remove();
          setCallState('active');
          setStatusText('Connected');
          startAudio();
        });

        WifiDirect.onConnectionFailed((e) => {
          console.error('❌ WiFi Direct failed:', e.error);
          endCall();
        });

        // Join caller's WiFi Direct group
        try {
          await WifiDirect.joinGroup(ssid, passphrase);
        } catch (e: any) {
          console.error('❌ joinGroup failed:', e);
          setStatusText('Connection failed');
          setTimeout(() => endCall(), 1500);
        }
      };

      signalingManager.on('call-accept', handleCredentials);

      // Also keep listening for call-end from caller
      const handleEnd = ({ signal }: any) => {
        if (signal.from !== callerId) return;
        signalingManager.off('call-end', handleEnd);
        endCall();
      };
      signalingManager.on('call-end', handleEnd);

      // Send accept — caller will respond with credentials
      console.log(`✅ Accepting call from ${callerName}`);
      await signalingManager.sendCallAccept(
        callerMac, callerId, myDeviceName || 'Unknown'
      );

    } catch (err: any) {
      console.error('❌ Accept error:', err);
      setStatusText('Error connecting');
      setTimeout(() => endCall(), 1500);
    }
  };

  const rejectCall = async () => {
    Vibration.cancel();
    await signalingManager.sendCallReject(callerMac, callerId).catch(() => {});
    cleanup();
    router.back();
  };

  const endCall = async () => {
    if (cleanedUp.current) return;
    setCallState('ended');
    setStatusText('Call ended');
    await signalingManager.sendCallEnd(callerMac, callerId).catch(() => {});
    cleanup();
    setTimeout(() => router.back(), 800);
  };

  const startAudio = () => {
    AudioStream.startCapture((b64: string) => {
      WifiDirect.sendAudio(b64).catch(() => {});
    });
    WifiDirect.onAudioReceived((e) => {
      AudioStream.playback(e.data);
    });
  };

  const cleanup = () => {
    if (cleanedUp.current) return;
    cleanedUp.current = true;
    Vibration.cancel();
    AudioStream.stop();
    WifiDirect.removeGroup();
    WifiDirect.removeAllListeners();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2,'0')}:${(s % 60).toString().padStart(2,'0')}`;

  return (
    <View style={styles.container}>
      <View style={[styles.avatarRing, {
        borderColor: callState === 'active' ? '#4CAF50' : '#2196F3'
      }]}>
        <Text style={styles.avatar}>👤</Text>
      </View>

      <Text style={styles.name}>{callerName}</Text>
      <Text style={styles.status}>{statusText}</Text>

      {callState === 'active' && (
        <Text style={styles.duration}>{fmt(callDuration)}</Text>
      )}

      {callState === 'ringing' && (
        <View style={styles.ringtoneRow}>
          <TouchableOpacity style={styles.rejectBtn} onPress={rejectCall}>
            <Text style={styles.btnIcon}>📵</Text>
            <Text style={styles.btnLabel}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.acceptBtn} onPress={acceptCall}>
            <Text style={styles.btnIcon}>📞</Text>
            <Text style={styles.btnLabel}>Accept</Text>
          </TouchableOpacity>
        </View>
      )}

      {(callState === 'connecting' || callState === 'active') && (
        <TouchableOpacity style={styles.endBtn} onPress={endCall}>
          <Text style={styles.btnIcon}>📵</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center', padding: 40 },
  avatarRing: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#16213e', alignItems: 'center', justifyContent: 'center', marginBottom: 24, borderWidth: 3 },
  avatar: { fontSize: 64 },
  name: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  status: { fontSize: 18, color: '#aaa', marginBottom: 8, textAlign: 'center' },
  duration: { fontSize: 24, color: '#4CAF50', fontFamily: 'monospace', marginBottom: 8 },
  ringtoneRow: { position: 'absolute', bottom: 80, flexDirection: 'row', gap: 80 },
  rejectBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f44336', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  acceptBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#4CAF50', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  endBtn: { position: 'absolute', bottom: 80, width: 80, height: 80, borderRadius: 40, backgroundColor: '#f44336', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  btnIcon: { fontSize: 32 },
  btnLabel: { fontSize: 11, color: '#fff', marginTop: 2 },
});