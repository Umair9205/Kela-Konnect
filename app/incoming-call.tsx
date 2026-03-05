/**
 * incoming-call.tsx — Incoming call screen
 * FR-8,9,10,11,12,13,14,30 | NFR-11,12
 *
 * Callee flow:
 * 1. WiFi Direct group already formed (caller created it)
 * 2. TCP signaling socket already connected (we joined caller's group)
 * 3. call-request arrived → this screen shown with vibration
 * 4. Accept → send call-accept → startCall('callee') → wait for SDP offer
 * 5. FR-30: auto-accept if friend has autoAccept=true
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ImageBackground, StatusBar, StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';
import WifiDirect from '../modules/WifiDirect';
import signalingManager from '../services/CallSignaling';
import webRTCService from '../services/WebRTCService';
import { useAppStore } from '../store/appStore';

const BG = require('../assets/images/banana-bg.png');
type State = 'ringing'|'connecting'|'active'|'ended';

export default function IncomingCallScreen() {
  const { callerName, callerUUID } = useLocalSearchParams<{ callerName:string; callerUUID:string }>();

  const [state, setState]       = useState<State>('ringing');
  const [status, setStatus]     = useState('');
  const [duration, setDuration] = useState(0);
  const [muted, setMuted]       = useState(false);
  const [speaker, setSpeaker]   = useState(false);

  const myName     = useAppStore(s => s.myDeviceName);
  const settings   = useAppStore(s => s.settings);
  const addRecord  = useAppStore(s => s.addCallRecord);
  const getFriend  = useAppStore(s => s.getFriendByUUID);

  const timerRef     = useRef<ReturnType<typeof setInterval>|null>(null);
  const cleanedUp    = useRef(false);
  const callEndRef   = useRef<any>(null);
  const callStartRef = useRef<Date>(new Date());

  useEffect(() => {
    Vibration.vibrate([0,500,300,500,300,500], true);

    callEndRef.current = () => {
      if (!cleanedUp.current) { setStatus('Call ended by caller'); setState('ended'); setTimeout(() => cleanup('completed'), 1500); }
    };
    signalingManager.on('call-end', callEndRef.current);

    // FR-30: auto-accept if configured
    const friend = getFriend(callerUUID);
    if (friend?.autoAccept) {
      setTimeout(() => acceptCall(), 500);
    }

    return () => { Vibration.cancel(); cleanup('missed'); };
  }, []);

  const acceptCall = async () => {
    Vibration.cancel();
    setState('connecting');
    setStatus('Connecting...');
    callStartRef.current = new Date();
    await signalingManager.sendCallAccept(callerUUID, myName ?? 'Unknown');
    await webRTCService.startCall('callee', {
      onConnected: () => { setState('active'); setStatus(''); startTimer(); },
      onDisconnected: () => { if (!cleanedUp.current) { setStatus('Connection lost'); setState('ended'); setTimeout(() => cleanup('failed'), 1500); } },
      onError: (err) => { setStatus(err); setState('ended'); setTimeout(() => cleanup('failed'), 2000); },
    }, settings.speakerDefault, settings.audioQuality);
  };

  const rejectCall = async () => {
    Vibration.cancel();
    await signalingManager.sendCallReject(callerUUID);
    cleanup('rejected');
  };

  const hangUp = async () => {
    await signalingManager.sendCallEnd(callerUUID);
    cleanup('completed');
  };

  const startTimer = () => { timerRef.current = setInterval(() => setDuration(d => d + 1), 1000); };
  const fmt = (s: number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  const toggleMute    = () => { const n = !muted;   setMuted(n);   webRTCService.setMuted(n); };
  const toggleSpeaker = () => { const n = !speaker; setSpeaker(n); webRTCService.setSpeaker(n); };

  const cleanup = (outcome: 'completed'|'missed'|'rejected'|'failed') => {
    if (cleanedUp.current) return;
    cleanedUp.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    if (callEndRef.current) { signalingManager.off('call-end', callEndRef.current); callEndRef.current = null; }
    webRTCService.stop();
    WifiDirect.removeGroup();
    addRecord({ friendUUID: callerUUID, friendName: callerName ?? '', direction: 'incoming', outcome, startedAt: callStartRef.current, duration });
    router.back();
  };

  const color = state === 'active' ? '#4ADE80' : state === 'ended' ? '#F87171' : state === 'connecting' ? '#F5C842' : '#fff';

  return (
    <ImageBackground source={BG} style={s.bg} resizeMode="cover">
      <StatusBar barStyle="light-content" />
      <View style={s.overlay}>
        <View style={s.top}>
          <Text style={s.label}>KELA-KONNECT</Text>
          <View style={s.avatar}><Text style={s.avatarTxt}>{(callerName??'?')[0].toUpperCase()}</Text></View>
          <Text style={s.name}>{callerName}</Text>
          <Text style={[s.stateText,{color}]}>
            {state === 'ringing' ? 'Incoming Call' : state === 'active' ? fmt(duration) : status || state}
          </Text>
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
          {state === 'ringing' ? (
            <View style={s.row}>
              <View style={s.col}>
                <TouchableOpacity style={s.reject} onPress={rejectCall} accessibilityLabel="Decline call" accessibilityRole="button">
                  <Text style={s.icon}>📵</Text>
                </TouchableOpacity>
                <Text style={s.lbl}>Decline</Text>
              </View>
              <View style={s.col}>
                <TouchableOpacity style={s.accept} onPress={acceptCall} accessibilityLabel="Accept call" accessibilityRole="button">
                  <Text style={s.icon}>📞</Text>
                </TouchableOpacity>
                <Text style={s.lbl}>Accept</Text>
              </View>
            </View>
          ) : (
            <View style={s.col}>
              <TouchableOpacity style={s.reject} onPress={hangUp} accessibilityLabel="End call" accessibilityRole="button">
                <Text style={s.icon}>📵</Text>
              </TouchableOpacity>
              <Text style={s.lbl}>End Call</Text>
            </View>
          )}
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
  bottom:{alignItems:'center'}, row:{flexDirection:'row',gap:80}, col:{alignItems:'center',gap:12},
  reject:{width:72,height:72,borderRadius:24,backgroundColor:'#F87171',alignItems:'center',justifyContent:'center',elevation:12},
  accept:{width:72,height:72,borderRadius:24,backgroundColor:'#4ADE80',alignItems:'center',justifyContent:'center',elevation:12},
  icon:{fontSize:32}, lbl:{fontSize:13,fontWeight:'700',color:'rgba(255,255,255,0.5)'},
});