import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, PermissionsAndroid, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  mediaDevices,
  MediaStream,
  MediaStreamTrack,
  RTCPeerConnection,
  RTCSessionDescription,
} from 'react-native-webrtc';
import { signalingManager } from '../services/CallSignaling';
import { useAppStore } from '../store/appStore';

type CallState = 'connecting' | 'ringing' | 'active' | 'ended';

export default function CallScreen() {
  const params = useLocalSearchParams();
  const friendId = params.friendId as string;
  const friendName = params.friendName as string;

  const [callState, setCallState] = useState<CallState>('connecting');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [signalingStatus, setSignalingStatus] = useState('Not connected');

  const myDeviceId = useAppStore(state => state.myDeviceId);

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const callTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    initializeCall();
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (callState === 'active') {
      callTimer.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (callTimer.current) {
        clearInterval(callTimer.current);
        callTimer.current = null;
      }
    };
  }, [callState]);

  const requestMicrophonePermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'Kela-Konnect needs access to your microphone for voice calls',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.error('Permission error:', err);
        return false;
      }
    }
    return true;
  };

  const initializeCall = async () => {
    try {
      console.log('🎤 Initializing call...');

      // Set my device ID for signaling
      if (myDeviceId) {
        signalingManager.setMyDeviceId(myDeviceId);
      }

      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        Alert.alert('Permission Denied', 'Microphone permission is required for calls');
        endCall();
        return;
      }

      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      }) as MediaStream;
      
      localStream.current = stream;
      console.log('✅ Microphone access granted');

      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      };

      peerConnection.current = new RTCPeerConnection(configuration);

      stream.getTracks().forEach((track: MediaStreamTrack) => {
        if (peerConnection.current && localStream.current) {
          peerConnection.current.addTrack(track, localStream.current);
        }
      });

      // ✅ UPDATED: Send ICE candidates via BLE
      (peerConnection.current as any).onicecandidate = (event: any) => {
        if (event.candidate) {
          console.log('🧊 ICE candidate:', event.candidate);
          signalingManager.sendIceCandidate(friendId, event.candidate)
            .then(success => {
              if (success) {
                console.log('✅ ICE candidate sent via BLE');
              } else {
                console.log('⚠️ Failed to send ICE candidate');
              }
            })
            .catch(error => {
              console.error('❌ Error sending ICE candidate:', error);
            });
        }
      };

      (peerConnection.current as any).ontrack = (event: any) => {
        console.log('🔊 Remote stream received');
      };

      // Create and send offer
      const offer = await peerConnection.current.createOffer({
        offerToReceiveAudio: true,
      });

      await peerConnection.current.setLocalDescription(offer);

      console.log('📞 Call offer created');
      
      // ✅ UPDATED: Send offer via BLE
      setCallState('ringing');
      setSignalingStatus('Connecting to device...');
      
      const offerSent = await signalingManager.sendOffer(friendId, offer);
      if (offerSent) {
        console.log('✅ Call offer sent via BLE');
        setSignalingStatus('Waiting for answer...');
      } else {
        console.log('❌ Failed to send offer');
        setSignalingStatus('Connection failed');
        Alert.alert('Call Failed', 'Could not connect to friend. Make sure they are broadcasting.');
        endCall();
        return;
      }

      // Listen for answer
      const handleAnswer = (data: any) => {
        if (data.from === friendId) {
          console.log('📥 Received answer from friend');
          const remoteDesc = new RTCSessionDescription(data.data.sdp);
          peerConnection.current?.setRemoteDescription(remoteDesc)
            .then(() => {
              console.log('✅ Remote description set');
              setCallState('active');
              setSignalingStatus('Connected');
            })
            .catch((error) => {
              console.error('❌ Error setting remote description:', error);
              setSignalingStatus('Connection error');
            });
        }
      };

      // Listen for ICE candidates from remote peer
      const handleIceCandidate = (data: any) => {
        if (data.from === friendId && data.data.candidate) {
          console.log('🧊 Received ICE candidate from friend');
          const candidate = data.data.candidate;
          peerConnection.current?.addIceCandidate(candidate)
            .then(() => {
              console.log('✅ ICE candidate added');
            })
            .catch((error) => {
              console.error('❌ Error adding ICE candidate:', error);
            });
        }
      };

      signalingManager.on('answer', handleAnswer);
      signalingManager.on('ice-candidate', handleIceCandidate);

    } catch (error) {
      console.error('❌ Call initialization error:', error);
      Alert.alert('Call Failed', 'Could not initialize call: ' + (error as Error).message);
      endCall();
    }
  };

  const toggleMute = () => {
    if (localStream.current) {
      const audioTracks = localStream.current.getAudioTracks();
      audioTracks.forEach((track: MediaStreamTrack) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
      console.log(isMuted ? '🎤 Unmuted' : '🔇 Muted');
    }
  };

  const cleanup = () => {
    console.log('🧹 Cleaning up call resources...');

    if (callTimer.current) {
      clearInterval(callTimer.current);
      callTimer.current = null;
    }

    if (localStream.current) {
      localStream.current.getTracks().forEach((track: MediaStreamTrack) => {
        track.stop();
      });
      localStream.current = null;
    }

    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    // Send call end signal
    signalingManager.sendCallEnd(friendId).catch(err => {
      console.error('Error sending call end:', err);
    });

    // Clean up signaling listeners
    signalingManager.stopListening();
  };

  const endCall = () => {
    console.log('📴 Ending call...');
    cleanup();
    setCallState('ended');
    
    setTimeout(() => {
      router.back();
    }, 1000);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.callInfo}>
        <Text style={styles.friendName}>{friendName}</Text>
        <Text style={styles.callStatus}>
          {callState === 'connecting' && '🔄 Connecting...'}
          {callState === 'ringing' && '📞 Ringing...'}
          {callState === 'active' && formatDuration(duration)}
          {callState === 'ended' && '📴 Call Ended'}
        </Text>
        <Text style={styles.signalingStatus}>
          {signalingStatus}
        </Text>
      </View>

      {callState === 'active' && (
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.controlButton, isMuted && styles.mutedButton]}
            onPress={toggleMute}
          >
            <Text style={styles.controlIcon}>{isMuted ? '🔇' : '🎤'}</Text>
            <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={[styles.endCallButton, callState === 'ended' && styles.endCallButtonDisabled]}
        onPress={endCall}
        disabled={callState === 'ended'}
      >
        <Text style={styles.endCallIcon}>📞</Text>
        <Text style={styles.endCallText}>End Call</Text>
      </TouchableOpacity>

      <View style={styles.debugInfo}>
        <Text style={styles.debugText}>
          {callState} • {friendId.substring(0, 8)}...
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'space-between',
    padding: 40,
  },
  callInfo: {
    alignItems: 'center',
    marginTop: 100,
  },
  friendName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  callStatus: {
    fontSize: 20,
    color: '#999',
  },
  signalingStatus: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    fontStyle: 'italic',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  controlButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mutedButton: {
    backgroundColor: '#F44336',
  },
  controlIcon: {
    fontSize: 32,
  },
  controlLabel: {
    color: '#fff',
    fontSize: 12,
    marginTop: 5,
  },
  endCallButton: {
    backgroundColor: '#F44336',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
  },
  endCallButtonDisabled: {
    backgroundColor: '#666',
  },
  endCallIcon: {
    fontSize: 32,
    marginBottom: 5,
  },
  endCallText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  debugInfo: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
  },
  debugText: {
    color: '#666',
    fontSize: 10,
    textAlign: 'center',
  },
});