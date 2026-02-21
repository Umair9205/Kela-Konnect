import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, PermissionsAndroid, Platform,
  StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import AudioStream from '../modules/AudioStream';
import WifiDirect from '../modules/WifiDirect';
import { signalingManager } from '../services/CallSignaling';
import { useAppStore } from '../store/appStore';

type CallState = 'creating-group' | 'calling' | 'waiting' | 'connecting' | 'active' | 'ended';

export default function CallScreen() {
  const { friendId, friendName, friendUUID } = useLocalSearchParams<{
    friendId: string;
    friendName: string;
    friendUUID: string;
  }>();

  const myUUID = useAppStore(state => state.myUUID);
  const myDeviceName = useAppStore(state => state.myDeviceName);

  const [callState, setCallState] = useState<CallState>('creating-group');
  const [statusText, setStatusText] = useState('Setting up...');
  const [callDuration, setCallDuration] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const callStartRef = useRef<number>(0);
  const cleanedUp = useRef(false);

  useEffect(() => {
    startCall();
    return () => { cleanup(); };
  }, []);

  useEffect(() => {
    if (callState === 'active') {
      callStartRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartRef.current) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [callState]);

  const startCall = async () => {
    try {
      // 1. Request mic permission
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission denied', 'Microphone access required for calls');
          router.back();
          return;
        }
      }

      // 2. Create WiFi Direct group FIRST — we are Group Owner
      setCallState('creating-group');
      setStatusText('Preparing connection...');
      console.log('📶 Creating WiFi Direct group...');

      let credentials: { ssid: string; passphrase: string };
      try {
        credentials = await WifiDirect.createGroup();
        console.log(`📶 Group ready: ${credentials.ssid}`);
      } catch (e: any) {
        Alert.alert('Setup failed', 'Could not create WiFi Direct group: ' + e?.message);
        router.back();
        return;
      }

      // 3. Set up listeners BEFORE sending call-request
      //    This prevents any race condition where accept arrives before we listen

      // Listen for call-reject
      const handleReject = ({ signal }: any) => {
        if (signal.from !== friendUUID) return;
        signalingManager.off('call-reject', handleReject);
        signalingManager.off('call-accept', handleAcceptAck);
        signalingManager.off('call-end', handleRemoteEnd);
        setCallState('ended');
        setStatusText('Call declined');
        setTimeout(() => router.back(), 1500);
      };

      // Listen for call-accept ACK from callee (just their acceptance, no creds)
      const handleAcceptAck = async ({ signal, fromMac }: any) => {
        if (signal.from !== friendUUID) return;
        signalingManager.off('call-accept', handleAcceptAck);
        signalingManager.off('call-reject', handleReject);
        console.log(`✅ Callee accepted. Sending WiFi credentials to ${fromMac}`);
        setCallState('connecting');
        setStatusText('Sharing connection details...');

        // Send credentials to callee so they can join our group
        await signalingManager.sendSignal(fromMac, {
          type: 'call-accept',
          from: myUUID!,
          to: friendUUID,
          data: {
            ssid: credentials.ssid,
            passphrase: credentials.passphrase,
            isCredentials: true,
          }
        });
      };

      // Listen for remote call-end
      const handleRemoteEnd = ({ signal }: any) => {
        if (signal.from !== friendUUID) return;
        cleanup();
        setCallState('ended');
        setStatusText('Call ended');
        setTimeout(() => router.back(), 800);
      };

      signalingManager.on('call-reject', handleReject);
      signalingManager.on('call-accept', handleAcceptAck);
      signalingManager.on('call-end', handleRemoteEnd);

      // Listen for WiFi Direct audio socket ready
      const audioReadySub = WifiDirect.onAudioReady(() => {
        audioReadySub.remove();
        setCallState('active');
        setStatusText('Connected');
        startAudio();
      });

      WifiDirect.onConnectionFailed((e) => {
        console.error('❌ WiFi Direct failed:', e.error);
        endCall();
      });

      // 4. Now send call-request
      setCallState('calling');
      setStatusText(`Calling ${friendName}...`);

      const sent = await signalingManager.sendCallRequest(
        friendId, friendUUID, myDeviceName || 'Unknown'
      );

      if (!sent) {
        Alert.alert('Call failed', 'Could not reach device. Make sure they are nearby.');
        cleanup();
        router.back();
      }

      setCallState('waiting');
      setStatusText(`Waiting for ${friendName} to answer...`);

    } catch (err: any) {
      console.error('❌ Call error:', err);
      Alert.alert('Call failed', err?.message || 'Unknown error');
      cleanup();
      router.back();
    }
  };

  const startAudio = () => {
    AudioStream.startCapture((b64: string) => {
      WifiDirect.sendAudio(b64).catch(() => {});
    });
    WifiDirect.onAudioReceived((e) => {
      AudioStream.playback(e.data);
    });
  };

  const endCall = async () => {
    if (cleanedUp.current) return;
    setCallState('ended');
    setStatusText('Call ended');
    if (friendId && friendUUID) {
      await signalingManager.sendCallEnd(friendId, friendUUID).catch(() => {});
    }
    cleanup();
    setTimeout(() => router.back(), 800);
  };

  const cleanup = () => {
    if (cleanedUp.current) return;
    cleanedUp.current = true;
    AudioStream.stop();
    WifiDirect.removeGroup();
    WifiDirect.removeAllListeners();
    if (timerRef.current) clearInterval(timerRef.current);
    signalingManager.off('call-reject', () => {});
    signalingManager.off('call-accept', () => {});
    signalingManager.off('call-end', () => {});
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2,'0')}:${(s % 60).toString().padStart(2,'0')}`;

  const stateColor = () => {
    if (callState === 'active') return '#4CAF50';
    if (callState === 'ended') return '#f44336';
    return '#2196F3';
  };

  return (
    <View style={styles.container}>
      <View style={[styles.avatarRing, { borderColor: stateColor() }]}>
        <Text style={styles.avatar}>👤</Text>
      </View>

      <Text style={styles.name}>{friendName}</Text>
      <Text style={styles.status}>{statusText}</Text>

      {callState === 'active' && (
        <Text style={styles.duration}>{fmt(callDuration)}</Text>
      )}

      {callState !== 'active' && callState !== 'ended' && (
        <Text style={styles.spinner}>⏳</Text>
      )}

      <TouchableOpacity
        style={styles.endBtn}
        onPress={endCall}
        disabled={callState === 'ended'}
      >
        <Text style={styles.endBtnText}>📵</Text>
      </TouchableOpacity>
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
  spinner: { fontSize: 32, marginBottom: 8 },
  endBtn: { position: 'absolute', bottom: 80, width: 80, height: 80, borderRadius: 40, backgroundColor: '#f44336', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  endBtnText: { fontSize: 36 },
});