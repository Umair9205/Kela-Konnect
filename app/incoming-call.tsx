import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ImageBackground, PermissionsAndroid, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';
import AudioStream from '../modules/AudioStream';
import WifiDirect from '../modules/WifiDirect';
import { signalingManager } from '../services/CallSignaling';
import { useAppStore } from '../store/appStore';

const BG = require('../assets/images/banana-bg.png');
type CallState = 'ringing' | 'connecting' | 'active' | 'ended';

export default function IncomingCallScreen() {
  const { callerId, callerName, callerMac } = useLocalSearchParams<{ callerId: string; callerName: string; callerMac: string; }>();
  const myDeviceName = useAppStore(s => s.myDeviceName);

  const [callState, setCallState] = useState<CallState>('ringing');
  const [statusText, setStatusText] = useState(`${callerName} is calling...`);
  const [callDuration, setCallDuration] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const callStartRef = useRef(0);
  const cleanedUp = useRef(false);
  const callerIdRef = useRef(callerId);
  const callerMacRef = useRef(callerMac);

  useEffect(() => {
    Vibration.vibrate([500, 500, 500, 500], true);
    const handleEnd = ({ signal }: any) => {
      if (signal.from !== callerIdRef.current) return;
      Vibration.cancel(); cleanup(); router.back();
    };
    signalingManager.on('call-end', handleEnd);
    return () => { Vibration.cancel(); signalingManager.off('call-end', handleEnd); cleanup(); };
  }, []);

  useEffect(() => {
    if (callState === 'active') {
      callStartRef.current = Date.now();
      timerRef.current = setInterval(() => setCallDuration(Math.floor((Date.now() - callStartRef.current) / 1000)), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callState]);

  const acceptCall = async () => {
    try {
      Vibration.cancel();
      setCallState('connecting'); setStatusText('Connecting...');
      if (Platform.OS === 'android') {
        const g = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (g !== PermissionsAndroid.RESULTS.GRANTED) { rejectCall(); return; }
      }
      const handleCreds = async ({ signal }: any) => {
        if (signal.from !== callerIdRef.current || !signal.data?.isCredentials) return;
        signalingManager.off('call-accept', handleCreds);
        setStatusText('Joining audio channel...');
        const audioSub = WifiDirect.onAudioReady(() => { audioSub.remove(); setCallState('active'); setStatusText('Connected'); startAudio(); });
        WifiDirect.onConnectionFailed(() => endCall());
        try { await WifiDirect.joinGroup(signal.data.ssid, signal.data.passphrase); }
        catch (e) { setStatusText('Connection failed'); setTimeout(() => endCall(), 1500); }
      };
      signalingManager.on('call-accept', handleCreds);
      const handleEnd2 = ({ signal }: any) => {
        if (signal.from !== callerIdRef.current) return;
        signalingManager.off('call-end', handleEnd2); endCall();
      };
      signalingManager.on('call-end', handleEnd2);
      await signalingManager.sendCallAccept(callerMacRef.current, callerIdRef.current, myDeviceName || 'Unknown');
    } catch (e) { setStatusText('Error connecting'); setTimeout(() => endCall(), 1500); }
  };

  const rejectCall = async () => {
    Vibration.cancel();
    try { await signalingManager.sendCallReject(callerMacRef.current, callerIdRef.current); } catch (e) {}
    cleanup(); router.back();
  };

  const endCall = async () => {
    if (cleanedUp.current) return;
    setCallState('ended'); setStatusText('Call ended');
    try { await signalingManager.sendCallEnd(callerMacRef.current, callerIdRef.current); } catch (e) {}
    cleanup(); setTimeout(() => router.back(), 800);
  };

  const startAudio = () => {
    AudioStream.startCapture((b64: string) => { WifiDirect.sendAudio(b64).catch(() => {}); });
    WifiDirect.onAudioReceived((e: any) => { AudioStream.playback(e.data); });
  };

  const cleanup = () => {
    if (cleanedUp.current) return;
    cleanedUp.current = true;
    Vibration.cancel(); AudioStream.stop(); WifiDirect.removeGroup(); WifiDirect.removeAllListeners();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <ImageBackground source={BG} style={styles.bg} resizeMode="cover">
      <StatusBar barStyle="light-content" />
      <View style={styles.overlay}>

        <View style={styles.topArea}>
          {callState === 'ringing' && (
            <View style={styles.incomingBadge}>
              <Text style={styles.incomingBadgeText}>📲  INCOMING CALL</Text>
            </View>
          )}
          {callState === 'active' && (
            <View style={styles.activeBadge}>
              <View style={styles.activeDot} />
              <Text style={styles.activeBadgeText}>LIVE</Text>
            </View>
          )}
        </View>

        <View style={styles.centerArea}>
          <View style={[styles.avatarRing, callState === 'active' ? styles.avatarRingActive : styles.avatarRingRinging]}>
            <View style={styles.avatarInner}>
              <Text style={styles.avatarLetter}>{callerName ? callerName.charAt(0).toUpperCase() : '?'}</Text>
            </View>
          </View>
          <Text style={styles.name}>{callerName}</Text>
          <Text style={styles.status}>{statusText}</Text>
          {callState === 'active' && (
            <View style={styles.timerBadge}>
              <Text style={styles.timer}>{fmt(callDuration)}</Text>
            </View>
          )}
        </View>

        <View style={styles.bottomArea}>
          {callState === 'ringing' && (
            <View style={styles.btnRow}>
              <View style={styles.btnCol}>
                <TouchableOpacity style={styles.rejectBtn} onPress={rejectCall}>
                  <Text style={styles.rejectBtnIcon}>📵</Text>
                </TouchableOpacity>
                <Text style={styles.btnLabel}>Decline</Text>
              </View>
              <View style={styles.btnCol}>
                <TouchableOpacity style={styles.acceptBtn} onPress={acceptCall}>
                  <Text style={styles.acceptBtnIcon}>📞</Text>
                </TouchableOpacity>
                <Text style={styles.btnLabel}>Accept</Text>
              </View>
            </View>
          )}
          {(callState === 'connecting' || callState === 'active') && (
            <View style={styles.btnCol}>
              <TouchableOpacity style={styles.rejectBtn} onPress={endCall}>
                <Text style={styles.rejectBtnIcon}>📵</Text>
              </TouchableOpacity>
              <Text style={styles.btnLabel}>End Call</Text>
            </View>
          )}
        </View>

      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', alignItems: 'center', justifyContent: 'space-between', paddingTop: 80, paddingBottom: 80 },
  topArea: { alignItems: 'center' },
  incomingBadge: { backgroundColor: 'rgba(245,200,66,0.12)', borderWidth: 1, borderColor: 'rgba(245,200,66,0.3)', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 9 },
  incomingBadgeText: { fontSize: 12, fontWeight: '800', color: '#F5C842', letterSpacing: 2 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(74,222,128,0.12)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 9 },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80' },
  activeBadgeText: { fontSize: 12, fontWeight: '800', color: '#4ADE80', letterSpacing: 2 },
  centerArea: { alignItems: 'center' },
  avatarRing: { width: 150, height: 150, borderRadius: 75, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  avatarRingRinging: { borderColor: 'rgba(245,200,66,0.5)' },
  avatarRingActive: { borderColor: 'rgba(74,222,128,0.5)' },
  avatarInner: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(245,200,66,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 56, fontWeight: '900', color: '#F5C842' },
  name: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: -1, marginBottom: 10 },
  status: { fontSize: 15, color: 'rgba(255,255,255,0.5)', fontWeight: '600', marginBottom: 20 },
  timerBadge: { backgroundColor: 'rgba(74,222,128,0.12)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.25)', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  timer: { fontSize: 22, fontWeight: '800', color: '#4ADE80' },
  bottomArea: { alignItems: 'center' },
  btnRow: { flexDirection: 'row', gap: 64, alignItems: 'center' },
  btnCol: { alignItems: 'center', gap: 10 },
  rejectBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F87171', alignItems: 'center', justifyContent: 'center', shadowColor: '#F87171', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 12 },
  rejectBtnIcon: { fontSize: 30 },
  acceptBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#4ADE80', alignItems: 'center', justifyContent: 'center', shadowColor: '#4ADE80', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 12 },
  acceptBtnIcon: { fontSize: 30 },
  btnLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '700' },
});