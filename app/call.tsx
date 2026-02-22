import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, PermissionsAndroid, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AudioStream from '../modules/AudioStream';
import WifiDirect from '../modules/WifiDirect';
import { signalingManager } from '../services/CallSignaling';
import { useAppStore } from '../store/appStore';

type CallState = 'creating-group' | 'calling' | 'waiting' | 'connecting' | 'active' | 'ended';

export default function CallScreen() {
  const { friendId, friendName, friendUUID } = useLocalSearchParams<{
    friendId: string; friendName: string; friendUUID: string;
  }>();

  const myUUID = useAppStore(state => state.myUUID);
  const myDeviceName = useAppStore(state => state.myDeviceName);

  const [callState, setCallState] = useState<CallState>('creating-group');
  const [statusText, setStatusText] = useState('Setting up...');
  const [callDuration, setCallDuration] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const callStartRef = useRef<number>(0);
  const cleanedUp = useRef(false);
  // Keep credentials in ref for use inside async callbacks
  const credentialsRef = useRef<{ ssid: string; passphrase: string } | null>(null);
  const friendUUIDRef = useRef(friendUUID);
  const friendIdRef = useRef(friendId);

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
      // 1. Mic permission
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission denied', 'Microphone access required for calls');
          router.back(); return;
        }
      }

      // 2. Create WiFi Direct group — we are always Group Owner (caller)
      setCallState('creating-group');
      setStatusText('Preparing connection...');
      console.log('📶 Creating WiFi Direct group...');

      let credentials: { ssid: string; passphrase: string };
      try {
        credentials = await WifiDirect.createGroup();
        credentialsRef.current = credentials;
        console.log(`📶 Group ready: ${credentials.ssid}`);
      } catch (e: any) {
        Alert.alert('Setup failed', 'Could not create WiFi Direct group: ' + e?.message);
        router.back(); return;
      }

      // 3. Register ALL listeners BEFORE sending call-request
      const handleReject = ({ signal }: any) => {
        if (signal.from !== friendUUIDRef.current) return;
        signalingManager.off('call-reject', handleReject);
        signalingManager.off('call-accept', handleAcceptAck);
        signalingManager.off('call-end', handleRemoteEnd);
        setCallState('ended');
        setStatusText('Call declined');
        setTimeout(() => router.back(), 1500);
      };

      const handleAcceptAck = async ({ signal, fromMac }: any) => {
        if (signal.from !== friendUUIDRef.current) return;
        if (signal.data?.isCredentials) return; // ignore our own cred message echoed back
        signalingManager.off('call-accept', handleAcceptAck);
        signalingManager.off('call-reject', handleReject);
        console.log(`✅ Callee accepted. Sending credentials to ${fromMac}`);
        setCallState('connecting');
        setStatusText('Sharing connection details...');

        // Send WiFi credentials to callee
        try {
          await signalingManager.sendSignal(fromMac, {
            type: 'call-accept',
            from: myUUID!,
            to: friendUUIDRef.current,
            data: {
              ssid: credentialsRef.current!.ssid,
              passphrase: credentialsRef.current!.passphrase,
              isCredentials: true,
            }
          });
        } catch (e) {
          console.error('❌ Failed to send credentials:', e);
          endCall();
        }
      };

      const handleRemoteEnd = ({ signal }: any) => {
        if (signal.from !== friendUUIDRef.current) return;
        cleanup();
        setCallState('ended');
        setStatusText('Call ended');
        setTimeout(() => router.back(), 800);
      };

      signalingManager.on('call-reject', handleReject);
      signalingManager.on('call-accept', handleAcceptAck);
      signalingManager.on('call-end', handleRemoteEnd);

      // WiFi Direct audio socket ready
      const audioReadySub = WifiDirect.onAudioReady(() => {
        audioReadySub.remove();
        setCallState('active');
        setStatusText('Connected');
        startAudio();
      });

      WifiDirect.onConnectionFailed(() => endCall());

      // 4. Send call-request via BLE
      setCallState('calling');
      setStatusText(`Calling ${friendName}...`);
      console.log(`📤 Sending call-request to UUID: ${friendUUIDRef.current} MAC: ${friendIdRef.current}`);

      const sent = await signalingManager.sendCallRequest(
        friendIdRef.current, friendUUIDRef.current, myDeviceName || 'Unknown'
      );

      if (!sent) {
        Alert.alert('Call failed', 'Could not reach device. Make sure they are nearby and their app is open.');
        cleanup(); router.back(); return;
      }

      setCallState('waiting');
      setStatusText(`Waiting for ${friendName} to answer...`);

    } catch (err: any) {
      console.error('❌ Call error:', err);
      Alert.alert('Call failed', err?.message || 'Unknown error');
      cleanup(); router.back();
    }
  };

  const startAudio = () => {
    AudioStream.startCapture((b64: string) => {
      WifiDirect.sendAudio(b64).catch(() => {});
    });
    WifiDirect.onAudioReceived((e: any) => {
      AudioStream.playback(e.data);
    });
  };

  const endCall = async () => {
    if (cleanedUp.current) return;
    setCallState('ended');
    setStatusText('Call ended');
    try {
      await signalingManager.sendCallEnd(friendIdRef.current, friendUUIDRef.current);
    } catch (e) {}
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
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <View style={styles.container}>
      <View style={[styles.avatarRing, {
        borderColor: callState === 'active' ? '#4CAF50' : callState === 'ended' ? '#f44336' : '#2196F3'
      }]}>
        <Text style={styles.avatar}>👤</Text>
      </View>
      <Text style={styles.name}>{friendName}</Text>
      <Text style={styles.status}>{statusText}</Text>
      {callState === 'active' && <Text style={styles.duration}>{fmt(callDuration)}</Text>}
      {callState !== 'active' && callState !== 'ended' && <Text style={styles.spinner}>⏳</Text>}
      <TouchableOpacity style={styles.endBtn} onPress={endCall} disabled={callState === 'ended'}>
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