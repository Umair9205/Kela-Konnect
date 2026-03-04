import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ImageBackground, StatusBar, StyleSheet, Text, TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import WifiDirect from '../modules/WifiDirect';
import { signalingManager } from '../services/CallSignaling';
import webRTCService from '../services/WebRTCService';
import { useAppStore } from '../store/appStore';

const BG = require('../assets/images/banana-bg.png');

type CallState = 'ringing' | 'connecting' | 'active' | 'ended';

export default function IncomingCallScreen() {
  const { callerName, callerUUID } = useLocalSearchParams<{
    callerName: string;
    callerUUID: string;
  }>();

  const [state, setState]         = useState<CallState>('ringing');
  const [duration, setDuration]   = useState(0);
  const [isMuted, setIsMuted]     = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const myName    = useAppStore(s => s.myDeviceName);
  const myUUID    = useAppStore(s => s.myUUID);
  const timerRef  = useRef<NodeJS.Timeout | null>(null);
  const cleanedUp = useRef(false);

  useEffect(() => {
    // Vibrate on incoming call
    Vibration.vibrate([0, 500, 300, 500, 300, 500], true);

    // ✅ FIX: single call-end listener registered once here, never duplicated
    signalingManager.on('call-end', handleRemoteEnd);

    return () => {
      Vibration.cancel();
      cleanup();
    };
  }, []);

  const handleRemoteEnd = () => {
    if (!cleanedUp.current) {
      setStatusMsg('Call ended by caller');
      setState('ended');
      setTimeout(cleanup, 1500);
    }
  };

  // ── Accept ─────────────────────────────────────────────────────────────────

  const acceptCall = async () => {
    Vibration.cancel();
    setState('connecting');
    setStatusMsg('Connecting...');

    // Send accept — WiFi Direct group already formed (we received call-request over TCP)
    await signalingManager.sendCallAccept(callerUUID, myName ?? 'Unknown');

    // Start WebRTC as callee (waits for SDP offer over TCP)
    await webRTCService.startCall('callee', {
      onConnected: () => {
        setState('active');
        setStatusMsg('');
        startTimer();
      },
      onDisconnected: () => {
        if (!cleanedUp.current) {
          setStatusMsg('Connection lost');
          setState('ended');
          setTimeout(cleanup, 1500);
        }
      },
      onError: (err) => {
        setStatusMsg(`Error: ${err}`);
        setState('ended');
        setTimeout(cleanup, 2000);
      },
    });
  };

  // ── Reject ─────────────────────────────────────────────────────────────────

  const rejectCall = async () => {
    Vibration.cancel();
    await signalingManager.sendCallReject(callerUUID);
    cleanup();
  };

  // ── Hang up ────────────────────────────────────────────────────────────────

  const hangUp = async () => {
    await signalingManager.sendCallEnd(callerUUID);
    cleanup();
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    webRTCService.setMuted(next);
  };

  const toggleSpeaker = () => {
    setIsSpeaker(s => !s);
  };

  // ── Timer ──────────────────────────────────────────────────────────────────

  const startTimer = () => {
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  // ── Cleanup ────────────────────────────────────────────────────────────────

  const cleanup = () => {
    if (cleanedUp.current) return;
    cleanedUp.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    signalingManager.off('call-end', handleRemoteEnd);
    webRTCService.stop();
    WifiDirect.removeGroup();
    WifiDirect.removeAllListeners();
    setState('ended');
    router.back();
  };

  // ── UI ─────────────────────────────────────────────────────────────────────

  const stateColor = () => {
    switch (state) {
      case 'active':     return '#4ADE80';
      case 'ended':      return '#F87171';
      case 'connecting': return '#F5C842';
      default:           return '#fff';
    }
  };

  const stateLabel = () => {
    switch (state) {
      case 'ringing':    return 'Incoming Call';
      case 'connecting': return statusMsg || 'Connecting...';
      case 'active':     return formatDuration(duration);
      case 'ended':      return statusMsg || 'Ended';
    }
  };

  return (
    <ImageBackground source={BG} style={styles.bg} resizeMode="cover">
      <StatusBar barStyle="light-content" />
      <View style={styles.overlay}>

        <View style={styles.topSection}>
          <Text style={styles.label}>KELA-KONNECT</Text>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(callerName ?? '?').charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{callerName}</Text>
          <Text style={[styles.stateText, { color: stateColor() }]}>{stateLabel()}</Text>
        </View>

        {state === 'active' && (
          <View style={styles.controls}>
            <TouchableOpacity style={[styles.ctrlBtn, isMuted && styles.ctrlBtnActive]} onPress={toggleMute}>
              <Text style={styles.ctrlIcon}>{isMuted ? '🔇' : '🎙️'}</Text>
              <Text style={styles.ctrlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.ctrlBtn, isSpeaker && styles.ctrlBtnActive]} onPress={toggleSpeaker}>
              <Text style={styles.ctrlIcon}>{isSpeaker ? '🔊' : '📞'}</Text>
              <Text style={styles.ctrlLabel}>{isSpeaker ? 'Speaker' : 'Earpiece'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomSection}>
          {state === 'ringing' ? (
            <View style={styles.answerRow}>
              <View style={styles.answerCol}>
                <TouchableOpacity style={styles.rejectBtn} onPress={rejectCall}>
                  <Text style={styles.actionIcon}>📵</Text>
                </TouchableOpacity>
                <Text style={styles.actionLabel}>Decline</Text>
              </View>
              <View style={styles.answerCol}>
                <TouchableOpacity style={styles.acceptBtn} onPress={acceptCall}>
                  <Text style={styles.actionIcon}>📞</Text>
                </TouchableOpacity>
                <Text style={styles.actionLabel}>Accept</Text>
              </View>
            </View>
          ) : (
            <View style={styles.answerCol}>
              <TouchableOpacity style={styles.rejectBtn} onPress={hangUp}>
                <Text style={styles.actionIcon}>📵</Text>
              </TouchableOpacity>
              <Text style={styles.actionLabel}>End Call</Text>
            </View>
          )}
        </View>

      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'space-between', paddingVertical: 60, paddingHorizontal: 24 },
  topSection: { alignItems: 'center', gap: 16 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 3, color: 'rgba(255,255,255,0.4)' },
  avatar: { width: 100, height: 100, borderRadius: 32, backgroundColor: '#F5C842', alignItems: 'center', justifyContent: 'center', shadowColor: '#F5C842', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 16 },
  avatarText: { fontSize: 44, fontWeight: '900', color: '#1a1a1a' },
  name: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  stateText: { fontSize: 18, fontWeight: '700' },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 32 },
  ctrlBtn: { alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, padding: 20, minWidth: 80 },
  ctrlBtnActive: { backgroundColor: 'rgba(245,200,66,0.2)', borderWidth: 1, borderColor: 'rgba(245,200,66,0.4)' },
  ctrlIcon: { fontSize: 28 },
  ctrlLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  bottomSection: { alignItems: 'center' },
  answerRow: { flexDirection: 'row', gap: 80 },
  answerCol: { alignItems: 'center', gap: 12 },
  rejectBtn: { width: 72, height: 72, borderRadius: 24, backgroundColor: '#F87171', alignItems: 'center', justifyContent: 'center', shadowColor: '#F87171', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 12 },
  acceptBtn: { width: 72, height: 72, borderRadius: 24, backgroundColor: '#4ADE80', alignItems: 'center', justifyContent: 'center', shadowColor: '#4ADE80', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 12 },
  actionIcon: { fontSize: 32 },
  actionLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
});