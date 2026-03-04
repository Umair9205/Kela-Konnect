import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ImageBackground, StatusBar, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import WifiDirect from '../modules/WifiDirect';
import { signalingManager } from '../services/CallSignaling';
import webRTCService from '../services/WebRTCService';
import { useAppStore } from '../store/appStore';

const BG = require('../assets/images/banana-bg.png');

type CallState = 'connecting' | 'ringing' | 'active' | 'ended';

export default function CallScreen() {
  const { peerAddress, friendName, friendUUID } = useLocalSearchParams<{
    peerAddress: string;
    friendName: string;
    friendUUID: string;
  }>();

  const [state, setState]       = useState<CallState>('connecting');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted]   = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Connecting via WiFi Direct...');

  const myUUID    = useAppStore(s => s.myUUID);
  const myName    = useAppStore(s => s.myDeviceName);
  const timerRef  = useRef<NodeJS.Timeout | null>(null);
  const cleanedUp = useRef(false);

  useEffect(() => {
    startCall();
    return () => { cleanup(); };
  }, []);

  // ── WiFi Direct → WebRTC flow ──────────────────────────────────────────────

  const startCall = async () => {
    // 1. Connect to peer via WiFi Direct
    setStatusMsg('Connecting via WiFi Direct...');
    try {
      await WifiDirect.connectToPeer(peerAddress);
    } catch (e: any) {
      setStatusMsg(`WiFi Direct failed: ${e?.message}`);
      setTimeout(cleanup, 2000);
      return;
    }

    // 2. Wait for group + signaling socket
    setStatusMsg('Establishing connection...');
    const groupSub = WifiDirect.onGroupFormed(async () => {
      groupSub.remove();

      // 3. Wait for TCP signaling socket ready
      const sigSub = WifiDirect.onSignalingReady(async () => {
        sigSub.remove();

        // 4. Send call-request
        setStatusMsg('Calling...');
        setState('ringing');
        await signalingManager.sendCallRequest(friendUUID, myName ?? 'Unknown');

        // 5. Listen for accept/reject/end
        const acceptHandler = ({ signal }: any) => {
          signalingManager.off('call-accept', acceptHandler);
          signalingManager.off('call-reject', rejectHandler);
          startWebRTC();
        };
        const rejectHandler = ({ signal }: any) => {
          signalingManager.off('call-accept', acceptHandler);
          signalingManager.off('call-reject', rejectHandler);
          setStatusMsg('Call rejected');
          setState('ended');
          setTimeout(cleanup, 1500);
        };

        signalingManager.on('call-accept', acceptHandler);
        signalingManager.on('call-reject', rejectHandler);
      });
    });

    // Connection failed handler
    const failSub = WifiDirect.onConnectionFailed(({ error }) => {
      failSub.remove();
      setStatusMsg(`Failed: ${error}`);
      setState('ended');
      setTimeout(cleanup, 2000);
    });
  };

  const startWebRTC = async () => {
    setStatusMsg('Starting audio...');
    await webRTCService.startCall('caller', {
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

    // Listen for remote call-end
    signalingManager.on('call-end', () => {
      if (!cleanedUp.current) {
        setStatusMsg('Call ended by peer');
        setState('ended');
        setTimeout(cleanup, 1500);
      }
    });
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

  // ── Actions ────────────────────────────────────────────────────────────────

  const hangUp = async () => {
    await signalingManager.sendCallEnd(friendUUID);
    cleanup();
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    webRTCService.setMuted(next);
  };

  const toggleSpeaker = () => {
    const next = !isSpeaker;
    setIsSpeaker(next);
    // AudioStream speaker toggle handled inside WebRTC audio session
  };

  const cleanup = () => {
    if (cleanedUp.current) return;
    cleanedUp.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    webRTCService.stop();
    WifiDirect.removeGroup();
    WifiDirect.removeAllListeners();
    signalingManager.off('call-end', () => {});
    setState('ended');
    router.back();
  };

  // ── UI ─────────────────────────────────────────────────────────────────────

  const stateColor = () => {
    switch (state) {
      case 'active': return '#4ADE80';
      case 'ended':  return '#F87171';
      default:       return '#F5C842';
    }
  };

  const stateLabel = () => {
    switch (state) {
      case 'connecting': return statusMsg || 'Connecting...';
      case 'ringing':    return 'Calling...';
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
            <Text style={styles.avatarText}>{(friendName ?? '?').charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{friendName}</Text>
          <Text style={[styles.stateText, { color: stateColor() }]}>{stateLabel()}</Text>
          {state === 'connecting' || state === 'ringing' ? (
            <View style={styles.pulseRing} />
          ) : null}
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
          <TouchableOpacity style={styles.hangUpBtn} onPress={hangUp}>
            <Text style={styles.hangUpIcon}>📵</Text>
          </TouchableOpacity>
          <Text style={styles.hangUpLabel}>End Call</Text>
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
  pulseRing: { width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: 'rgba(245,200,66,0.3)', position: 'absolute', top: 50 },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 32 },
  ctrlBtn: { alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, padding: 20, minWidth: 80 },
  ctrlBtnActive: { backgroundColor: 'rgba(245,200,66,0.2)', borderWidth: 1, borderColor: 'rgba(245,200,66,0.4)' },
  ctrlIcon: { fontSize: 28 },
  ctrlLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  bottomSection: { alignItems: 'center', gap: 12 },
  hangUpBtn: { width: 72, height: 72, borderRadius: 24, backgroundColor: '#F87171', alignItems: 'center', justifyContent: 'center', shadowColor: '#F87171', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 12 },
  hangUpIcon: { fontSize: 32 },
  hangUpLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
});