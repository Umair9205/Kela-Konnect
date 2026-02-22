import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform, StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';
import AudioStream from '../modules/AudioStream';
import WifiDirect from '../modules/WifiDirect';
import { signalingManager } from '../services/CallSignaling';
import { useAppStore } from '../store/appStore';

type CallState = 'ringing' | 'connecting' | 'active' | 'ended';

export default function IncomingCallScreen() {
  const { callerId, callerName, callerMac } = useLocalSearchParams<{
    callerId: string; callerName: string; callerMac: string;
  }>();

  const myDeviceName = useAppStore(state => state.myDeviceName);

  const [callState, setCallState] = useState<CallState>('ringing');
  const [statusText, setStatusText] = useState(`${callerName} is calling...`);
  const [callDuration, setCallDuration] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const callStartRef = useRef<number>(0);
  const cleanedUp = useRef(false);
  // Keep params in refs for use inside async callbacks (stale closure prevention)
  const callerIdRef = useRef(callerId);
  const callerMacRef = useRef(callerMac);

  useEffect(() => {
    Vibration.vibrate([500, 500, 500, 500], true);

    const handleCallerEnd = ({ signal }: any) => {
      if (signal.from !== callerIdRef.current) return;
      Vibration.cancel();
      cleanup();
      router.back();
    };
    signalingManager.on('call-end', handleCallerEnd);

    return () => {
      Vibration.cancel();
      signalingManager.off('call-end', handleCallerEnd);
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
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          rejectCall(); return;
        }
      }

      // Listen for WiFi credentials BEFORE sending accept (no race condition)
      const handleCredentials = async ({ signal }: any) => {
        if (signal.from !== callerIdRef.current) return;
        if (!signal.data?.isCredentials) return;
        signalingManager.off('call-accept', handleCredentials);

        const { ssid, passphrase } = signal.data;
        console.log(`📶 Got credentials: ${ssid}`);
        setStatusText('Joining audio channel...');

        const audioSub = WifiDirect.onAudioReady(() => {
          audioSub.remove();
          setCallState('active');
          setStatusText('Connected');
          startAudio();
        });

        WifiDirect.onConnectionFailed(() => endCall());

        try {
          await WifiDirect.joinGroup(ssid, passphrase);
        } catch (e: any) {
          console.error('❌ joinGroup failed:', e);
          setStatusText('Connection failed');
          setTimeout(() => endCall(), 1500);
        }
      };

      signalingManager.on('call-accept', handleCredentials);

      // Listen for caller ending mid-call
      const handleCallEnd = ({ signal }: any) => {
        if (signal.from !== callerIdRef.current) return;
        signalingManager.off('call-end', handleCallEnd);
        endCall();
      };
      signalingManager.on('call-end', handleCallEnd);

      // Send accept ACK — caller will reply with WiFi credentials
      console.log(`✅ Accepting call from ${callerName}`);
      await signalingManager.sendCallAccept(
        callerMacRef.current, callerIdRef.current, myDeviceName || 'Unknown'
      );

    } catch (err: any) {
      console.error('❌ Accept error:', err);
      setStatusText('Error connecting');
      setTimeout(() => endCall(), 1500);
    }
  };

  const rejectCall = async () => {
    Vibration.cancel();
    try { await signalingManager.sendCallReject(callerMacRef.current, callerIdRef.current); } catch (e) {}
    cleanup();
    router.back();
  };

  const endCall = async () => {
    if (cleanedUp.current) return;
    setCallState('ended');
    setStatusText('Call ended');
    try { await signalingManager.sendCallEnd(callerMacRef.current, callerIdRef.current); } catch (e) {}
    cleanup();
    setTimeout(() => router.back(), 800);
  };

  const startAudio = () => {
    AudioStream.startCapture((b64: string) => {
      WifiDirect.sendAudio(b64).catch(() => {});
    });
    WifiDirect.onAudioReceived((e: any) => {
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
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <View style={styles.container}>
      <View style={[styles.avatarRing, {
        borderColor: callState === 'active' ? '#4CAF50' : '#2196F3'
      }]}>
        <Text style={styles.avatar}>👤</Text>
      </View>
      <Text style={styles.name}>{callerName}</Text>
      <Text style={styles.status}>{statusText}</Text>
      {callState === 'active' && <Text style={styles.duration}>{fmt(callDuration)}</Text>}

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