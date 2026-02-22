import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, ImageBackground, PermissionsAndroid, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AudioStream from '../modules/AudioStream';
import WifiDirect from '../modules/WifiDirect';
import { signalingManager } from '../services/CallSignaling';
import { useAppStore } from '../store/appStore';

const BG = require('../assets/images/banana-bg.png');
type CallState = 'creating-group' | 'calling' | 'waiting' | 'connecting' | 'active' | 'ended';

export default function CallScreen() {
  const { friendId, friendName, friendUUID } = useLocalSearchParams<{ friendId: string; friendName: string; friendUUID: string; }>();
  const myUUID = useAppStore(s => s.myUUID);
  const myDeviceName = useAppStore(s => s.myDeviceName);

  const [callState, setCallState] = useState<CallState>('creating-group');
  const [statusText, setStatusText] = useState('Setting up...');
  const [callDuration, setCallDuration] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const callStartRef = useRef(0);
  const cleanedUp = useRef(false);
  const credRef = useRef<{ ssid: string; passphrase: string } | null>(null);
  const uuidRef = useRef(friendUUID);
  const idRef = useRef(friendId);

  useEffect(() => { startCall(); return () => cleanup(); }, []);
  useEffect(() => {
    if (callState === 'active') {
      callStartRef.current = Date.now();
      timerRef.current = setInterval(() => setCallDuration(Math.floor((Date.now() - callStartRef.current) / 1000)), 1000);
    } else if (timerRef.current) clearInterval(timerRef.current);
  }, [callState]);

  const startCall = async () => {
    try {
      if (Platform.OS === 'android') {
        const g = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (g !== PermissionsAndroid.RESULTS.GRANTED) { Alert.alert('Permission required', 'Mic access needed for calls'); router.back(); return; }
      }
      setCallState('creating-group'); setStatusText('Preparing connection...');
      const creds = await WifiDirect.createGroup();
      credRef.current = creds;

      const handleReject = ({ signal }: any) => {
        if (signal.from !== uuidRef.current) return;
        signalingManager.off('call-reject', handleReject);
        signalingManager.off('call-accept', handleAccept);
        signalingManager.off('call-end', handleEnd);
        setCallState('ended'); setStatusText('Call declined');
        setTimeout(() => router.back(), 1500);
      };
      const handleAccept = async ({ signal, fromMac }: any) => {
        if (signal.from !== uuidRef.current) return;
        if (signal.data?.isCredentials) return;
        signalingManager.off('call-accept', handleAccept);
        signalingManager.off('call-reject', handleReject);
        setCallState('connecting'); setStatusText('Connecting...');
        await signalingManager.sendSignal(fromMac, {
          type: 'call-accept', from: myUUID!, to: uuidRef.current,
          data: { ssid: credRef.current!.ssid, passphrase: credRef.current!.passphrase, isCredentials: true }
        });
      };
      const handleEnd = ({ signal }: any) => {
        if (signal.from !== uuidRef.current) return;
        cleanup(); setCallState('ended'); setStatusText('Call ended');
        setTimeout(() => router.back(), 800);
      };
      signalingManager.on('call-reject', handleReject);
      signalingManager.on('call-accept', handleAccept);
      signalingManager.on('call-end', handleEnd);

      const audioSub = WifiDirect.onAudioReady(() => { audioSub.remove(); setCallState('active'); setStatusText('Connected'); startAudio(); });
      WifiDirect.onConnectionFailed(() => endCall());

      setCallState('calling'); setStatusText(`Calling ${friendName}...`);
      const sent = await signalingManager.sendCallRequest(idRef.current, uuidRef.current, myDeviceName || 'Unknown');
      if (!sent) { Alert.alert('Call failed', 'Could not reach device. Make sure their app is open.'); cleanup(); router.back(); return; }
      setCallState('waiting'); setStatusText(`Waiting for ${friendName}...`);
    } catch (e: any) { Alert.alert('Error', e?.message || 'Unknown error'); cleanup(); router.back(); }
  };

  const startAudio = () => {
    AudioStream.startCapture((b64: string) => { WifiDirect.sendAudio(b64).catch(() => {}); });
    WifiDirect.onAudioReceived((e: any) => { AudioStream.playback(e.data); });
  };

  const endCall = async () => {
    if (cleanedUp.current) return;
    setCallState('ended'); setStatusText('Call ended');
    try { await signalingManager.sendCallEnd(idRef.current, uuidRef.current); } catch (e) {}
    cleanup(); setTimeout(() => router.back(), 800);
  };

  const cleanup = () => {
    if (cleanedUp.current) return;
    cleanedUp.current = true;
    AudioStream.stop(); WifiDirect.removeGroup(); WifiDirect.removeAllListeners();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const stateConfig = {
    'creating-group': { label: 'SETTING UP', color: '#F5C842' },
    'calling':        { label: 'CALLING',     color: '#F5C842' },
    'waiting':        { label: 'RINGING',     color: '#F5C842' },
    'connecting':     { label: 'CONNECTING',  color: '#F5C842' },
    'active':         { label: 'LIVE',        color: '#4ADE80' },
    'ended':          { label: 'ENDED',       color: '#F87171' },
  };
  const cfg = stateConfig[callState];

  return (
    <ImageBackground source={BG} style={styles.bg} resizeMode="cover">
      <StatusBar barStyle="light-content" />
      <View style={styles.overlay}>

        {/* Status badge */}
        <View style={styles.topArea}>
          <View style={[styles.stateBadge, { borderColor: cfg.color + '44', backgroundColor: cfg.color + '15' }]}>
            <View style={[styles.stateDot, { backgroundColor: cfg.color }]} />
            <Text style={[styles.stateLabel, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        {/* Avatar */}
        <View style={styles.centerArea}>
          <View style={[styles.avatarRing, { borderColor: cfg.color + '55' }]}>
            <View style={[styles.avatarInner, { backgroundColor: cfg.color + '20' }]}>
              <Text style={styles.avatarLetter}>
                {friendName ? friendName.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
          </View>
          <Text style={styles.name}>{friendName}</Text>
          <Text style={styles.status}>{statusText}</Text>
          {callState === 'active' && (
            <View style={styles.timerBadge}>
              <Text style={styles.timer}>{fmt(callDuration)}</Text>
            </View>
          )}
        </View>

        {/* End button */}
        <View style={styles.bottomArea}>
          <TouchableOpacity style={styles.endBtn} onPress={endCall} disabled={callState === 'ended'}>
            <Text style={styles.endBtnIcon}>📵</Text>
          </TouchableOpacity>
          <Text style={styles.endBtnLabel}>End Call</Text>
        </View>

      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'space-between', paddingTop: 80, paddingBottom: 80 },
  topArea: { alignItems: 'center' },
  stateBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  stateDot: { width: 7, height: 7, borderRadius: 4 },
  stateLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  centerArea: { alignItems: 'center' },
  avatarRing: { width: 150, height: 150, borderRadius: 75, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  avatarInner: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 56, fontWeight: '900', color: '#F5C842' },
  name: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: -1, marginBottom: 10 },
  status: { fontSize: 15, color: 'rgba(255,255,255,0.5)', fontWeight: '600', marginBottom: 20 },
  timerBadge: { backgroundColor: 'rgba(74,222,128,0.12)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.25)', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  timer: { fontSize: 22, fontWeight: '800', color: '#4ADE80', fontVariant: ['tabular-nums'] },
  bottomArea: { alignItems: 'center', gap: 12 },
  endBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F87171', alignItems: 'center', justifyContent: 'center', shadowColor: '#F87171', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 12 },
  endBtnIcon: { fontSize: 30 },
  endBtnLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '700' },
});