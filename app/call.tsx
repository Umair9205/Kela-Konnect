/**
 * call.tsx — Outgoing call screen
 * FR-6,7,10,11,12,13,14 | NFR-1,2,12
 *
 * Caller flow:
 * 1. createGroup() → becomes WiFi Direct Group Owner
 * 2. Native layer opens TCP signaling server (port 9875) automatically on group formed
 * 3. When callee connects → TCP socket ready → send call-request
 * 4. On call-accept → startCall('caller') → send SDP offer → ICE → audio
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ImageBackground, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import WifiDirect from '../modules/WifiDirect';
import signalingManager from '../services/CallSignaling';
import webRTCService from '../services/WebRTCService';
import { useAppStore } from '../store/appStore';

const BG = require('../assets/images/banana-bg.png');
type State = 'creating-group'|'waiting-peer'|'ringing'|'active'|'ended';

export default function CallScreen() {
  const { friendName, friendUUID } = useLocalSearchParams<{ friendName:string; friendUUID:string }>();

  const [state, setState]       = useState<State>('creating-group');
  const [status, setStatus]     = useState('Creating WiFi Direct group...');
  const [duration, setDuration] = useState(0);
  const [muted, setMuted]       = useState(false);
  const [speaker, setSpeaker]   = useState(false);

  const myName    = useAppStore(s => s.myDeviceName);
  const settings  = useAppStore(s => s.settings);
  const addRecord = useAppStore(s => s.addCallRecord);

  const timerRef     = useRef<ReturnType<typeof setInterval>|null>(null);
  const cleanedUp    = useRef(false);
  const callEndRef   = useRef<any>(null);
  const callStartRef = useRef<Date>(new Date());

  useEffect(() => {
    startCall();
    return () => { cleanup('failed'); };
  }, []);

  const startCall = async () => {
    try {
      setStatus('Creating WiFi Direct group...');
      setState('creating-group');
      await WifiDirect.createGroup();

      // Wait for group owner + TCP signaling server ready
      const sigSub = WifiDirect.onSignalingReady(() => {
        sigSub.remove();
        setState('waiting-peer');
        setStatus('Waiting for peer to connect...');
        // Once callee connects to our TCP server, send call request
        sendCallRequest();
      });

      const failSub = WifiDirect.onConnectionFailed(({ error }) => {
        failSub.remove();
        setStatus(`Failed: ${error}`);
        setState('ended');
        setTimeout(() => cleanup('failed'), 2000);
      });

    } catch (e: any) {
      setStatus(`Error: ${e?.message}`);
      setState('ended');
      setTimeout(() => cleanup('failed'), 2000);
    }
  };

  const sendCallRequest = async () => {
    setStatus('Calling...');
    setState('ringing');
    callStartRef.current = new Date();
    await signalingManager.sendCallRequest(friendUUID, myName ?? 'Unknown');

    const acceptRef = { fn: (_: any) => {} };
    const rejectRef = { fn: (_: any) => {} };

    acceptRef.fn = () => {
      signalingManager.off('call-accept', acceptRef.fn);
      signalingManager.off('call-reject', rejectRef.fn);
      launchWebRTC();
    };
    rejectRef.fn = () => {
      signalingManager.off('call-accept', acceptRef.fn);
      signalingManager.off('call-reject', rejectRef.fn);
      setStatus('Call rejected');
      setState('ended');
      setTimeout(() => cleanup('rejected'), 1500);
    };

    signalingManager.on('call-accept', acceptRef.fn);
    signalingManager.on('call-reject', rejectRef.fn);
  };

  const launchWebRTC = async () => {
    setStatus('Starting audio...');
    callStartRef.current = new Date();

    callEndRef.current = () => {
      if (!cleanedUp.current) { setStatus('Call ended by peer'); setState('ended'); setTimeout(() => cleanup('completed'), 1500); }
    };
    signalingManager.on('call-end', callEndRef.current);

    await webRTCService.startCall('caller', {
      onConnected: () => { setState('active'); setStatus(''); startTimer(); },
      onDisconnected: () => { if (!cleanedUp.current) { setStatus('Connection lost'); setState('ended'); setTimeout(() => cleanup('failed'), 1500); } },
      onError: (err) => { setStatus(err); setState('ended'); setTimeout(() => cleanup('failed'), 2000); },
    }, settings.speakerDefault, settings.audioQuality);
  };

  const startTimer = () => { timerRef.current = setInterval(() => setDuration(d => d + 1), 1000); };
  const fmt = (s: number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  const hangUp = async () => {
    await signalingManager.sendCallEnd(friendUUID);
    cleanup(state === 'active' ? 'completed' : 'failed');
  };

  const toggleMute    = () => { const n = !muted;   setMuted(n);   webRTCService.setMuted(n); };
  const toggleSpeaker = () => { const n = !speaker; setSpeaker(n); webRTCService.setSpeaker(n); };

  const cleanup = (outcome: 'completed'|'failed'|'rejected') => {
    if (cleanedUp.current) return;
    cleanedUp.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    if (callEndRef.current) { signalingManager.off('call-end', callEndRef.current); callEndRef.current = null; }
    webRTCService.stop();
    WifiDirect.removeGroup();
    // Log call record (FR-17)
    addRecord({ friendUUID, friendName: friendName ?? '', direction: 'outgoing', outcome, startedAt: callStartRef.current, duration });
    router.back();
  };

  const color = state === 'active' ? '#4ADE80' : state === 'ended' ? '#F87171' : '#F5C842';

  return (
    <ImageBackground source={BG} style={s.bg} resizeMode="cover">
      <StatusBar barStyle="light-content" />
      <View style={s.overlay}>
        <View style={s.top}>
          <Text style={s.label}>KELA-KONNECT</Text>
          <View style={s.avatar}><Text style={s.avatarTxt}>{(friendName??'?')[0].toUpperCase()}</Text></View>
          <Text style={s.name}>{friendName}</Text>
          <Text style={[s.stateText,{color}]}>{state==='active' ? fmt(duration) : status || state}</Text>
        </View>

        {state === 'active' && (
          <View style={s.controls}>
            <TouchableOpacity style={[s.ctrl, muted && s.ctrlOn]} onPress={toggleMute}>
              <Text style={s.ctrlIcon}>{muted ? '🔇' : '🎙️'}</Text>
              <Text style={s.ctrlLbl}>{muted ? 'Unmute' : 'Mute'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.ctrl, speaker && s.ctrlOn]} onPress={toggleSpeaker}>
              <Text style={s.ctrlIcon}>{speaker ? '🔊' : '📞'}</Text>
              <Text style={s.ctrlLbl}>{speaker ? 'Speaker' : 'Earpiece'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={s.bottom}>
          <TouchableOpacity style={s.hangup} onPress={hangUp} accessibilityLabel="End call" accessibilityRole="button">
            <Text style={s.hangupIcon}>📵</Text>
          </TouchableOpacity>
          <Text style={s.hangupLbl}>End Call</Text>
        </View>
      </View>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  bg:{flex:1}, overlay:{flex:1,backgroundColor:'rgba(0,0,0,0.55)',justifyContent:'space-between',paddingVertical:60,paddingHorizontal:24},
  top:{alignItems:'center',gap:16}, label:{fontSize:10,fontWeight:'700',letterSpacing:3,color:'rgba(255,255,255,0.4)'},
  avatar:{width:100,height:100,borderRadius:32,backgroundColor:'#F5C842',alignItems:'center',justifyContent:'center',elevation:16},
  avatarTxt:{fontSize:44,fontWeight:'900',color:'#1a1a1a'}, name:{fontSize:28,fontWeight:'900',color:'#fff'},
  stateText:{fontSize:18,fontWeight:'700'},
  controls:{flexDirection:'row',justifyContent:'center',gap:32},
  ctrl:{alignItems:'center',gap:8,backgroundColor:'rgba(255,255,255,0.08)',borderRadius:20,padding:20,minWidth:80},
  ctrlOn:{backgroundColor:'rgba(245,200,66,0.2)',borderWidth:1,borderColor:'rgba(245,200,66,0.4)'},
  ctrlIcon:{fontSize:28}, ctrlLbl:{fontSize:12,fontWeight:'700',color:'rgba(255,255,255,0.7)'},
  bottom:{alignItems:'center',gap:12},
  hangup:{width:72,height:72,borderRadius:24,backgroundColor:'#F87171',alignItems:'center',justifyContent:'center',elevation:12},
  hangupIcon:{fontSize:32}, hangupLbl:{fontSize:13,fontWeight:'700',color:'rgba(255,255,255,0.5)'},
});