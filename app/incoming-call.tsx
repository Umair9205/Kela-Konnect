import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';
import {
  mediaDevices,
  MediaStream,
  MediaStreamTrack,
  RTCPeerConnection,
  RTCSessionDescription,
} from 'react-native-webrtc';
import { signalingManager } from '../services/CallSignaling';

export default function IncomingCallScreen() {
  const params = useLocalSearchParams();
  const callerName = params.callerName as string;
  const callerId = params.callerId as string;
  const offerSdp = params.offerSdp as string;

  const [callState, setCallState] = useState<'ringing' | 'active' | 'ended'>('ringing');
  const [duration, setDuration] = useState(0);

  const peerConnection = React.useRef<RTCPeerConnection | null>(null);
  const localStream = React.useRef<MediaStream | null>(null);
  const callTimer = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Vibrate on incoming call
    Vibration.vibrate([500, 500, 500, 500], true);

    return () => {
      Vibration.cancel();
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (callState === 'active') {
      Vibration.cancel();
      callTimer.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (callTimer.current) {
        clearInterval(callTimer.current);
      }
    };
  }, [callState]);

  const handleAccept = async () => {
    try {
      console.log('✅ Accepting call from', callerName);
      Vibration.cancel();

      // Get microphone
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      }) as MediaStream;
      localStream.current = stream;

      // Create peer connection
      peerConnection.current = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      // Add tracks
      stream.getTracks().forEach((track: MediaStreamTrack) => {
        if (peerConnection.current && localStream.current) {
          peerConnection.current.addTrack(track, localStream.current);
        }
      });

      // Handle ICE candidates
      (peerConnection.current as any).onicecandidate = (event: any) => {
        if (event.candidate) {
          signalingManager.sendIceCandidate(callerId, event.candidate);
        }
      };

      // Handle remote stream
      (peerConnection.current as any).ontrack = (event: any) => {
        console.log('🔊 Remote stream received');
      };

      // Set remote description (the offer)
      // ✅ Guard: only parse if offerSdp is a real SDP string
      if (!offerSdp || offerSdp === '' || offerSdp === 'null' || offerSdp === 'undefined') {
        console.log('⚠️ No offer SDP received - waiting for offer via BLE signaling');
        
        // Listen for the offer to arrive via BLE instead
        signalingManager.on('offer', async (data: any) => {
          if (data.from === callerId) {
            try {
              const receivedOffer = data.data?.sdp;
              await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(receivedOffer));
              const answer = await peerConnection.current!.createAnswer();
              await peerConnection.current!.setLocalDescription(answer);
              await signalingManager.sendAnswer(callerId, answer);
              setCallState('active');
            } catch (err) {
              console.error('❌ Error handling late offer:', err);
            }
          }
        });
        return;
      }

      const offer = JSON.parse(offerSdp);
      await peerConnection.current.setRemoteDescription(
        new RTCSessionDescription(offer)
      );

      // Create answer
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);

      // Send answer via BLE
      await signalingManager.sendAnswer(callerId, answer);
      console.log('📤 Answer sent to', callerName);

      // Listen for ICE candidates from caller
      signalingManager.on('ice-candidate', (data: any) => {
        if (data.from === callerId && data.data?.candidate) {
          peerConnection.current?.addIceCandidate(data.data.candidate)
            .then(() => console.log('✅ ICE candidate added'))
            .catch((err: any) => console.error('❌ ICE error:', err));
        }
      });

      // Listen for call end
      signalingManager.on('call-end', (data: any) => {
        if (data.from === callerId) {
          console.log('📴 Caller ended the call');
          endCall();
        }
      });

      setCallState('active');

    } catch (error) {
      console.error('❌ Error accepting call:', error);
      endCall();
    }
  };

  const handleReject = async () => {
    console.log('❌ Rejecting call from', callerName);
    await signalingManager.sendCallReject(callerId);
    endCall();
  };

  const cleanup = () => {
    if (callTimer.current) clearInterval(callTimer.current);
    if (localStream.current) {
      localStream.current.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      localStream.current = null;
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
  };

  const endCall = () => {
    cleanup();
    setCallState('ended');
    signalingManager.sendCallEnd(callerId).catch(console.error);
    setTimeout(() => router.back(), 1000);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.callerInfo}>
        <Text style={styles.callerIcon}>📞</Text>
        <Text style={styles.callerName}>{callerName}</Text>
        <Text style={styles.callStatus}>
          {callState === 'ringing' && '📲 Incoming Call...'}
          {callState === 'active' && formatDuration(duration)}
          {callState === 'ended' && '📴 Call Ended'}
        </Text>
      </View>

      {callState === 'ringing' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.rejectButton}
            onPress={handleReject}
          >
            <Text style={styles.actionIcon}>📵</Text>
            <Text style={styles.actionLabel}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.acceptButton}
            onPress={handleAccept}
          >
            <Text style={styles.actionIcon}>📞</Text>
            <Text style={styles.actionLabel}>Accept</Text>
          </TouchableOpacity>
        </View>
      )}

      {callState === 'active' && (
        <TouchableOpacity
          style={styles.endCallButton}
          onPress={endCall}
        >
          <Text style={styles.endCallIcon}>📞</Text>
          <Text style={styles.endCallText}>End Call</Text>
        </TouchableOpacity>
      )}
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
  callerInfo: {
    alignItems: 'center',
    marginTop: 120,
  },
  callerIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  callerName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  callStatus: {
    fontSize: 20,
    color: '#999',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 60,
  },
  rejectButton: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  acceptButton: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  actionIcon: {
    fontSize: 36,
  },
  actionLabel: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    fontWeight: 'bold',
  },
  endCallButton: {
    backgroundColor: '#F44336',
    paddingVertical: 20,
    borderRadius: 50,
    alignItems: 'center',
    marginBottom: 60,
    elevation: 5,
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
});