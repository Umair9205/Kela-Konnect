import { signalingManager } from '../services/CallSignaling';

// Add at the top of the component
const [signalingStatus, setSignalingStatus] = useState('Not connected');

// Update the initializeCall function
const initializeCall = async () => {
  try {
    console.log('🎤 Initializing call...');

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
    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 ICE candidate:', event.candidate);
        signalingManager.sendIceCandidate(friendId, event.candidate)
          .then(success => {
            if (success) {
              console.log('✅ ICE candidate sent via BLE');
            } else {
              console.log('⚠️ Failed to send ICE candidate');
            }
          });
      }
    };

    peerConnection.current.ontrack = (event) => {
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
    setSignalingStatus('Sending call request...');
    
    const offerSent = await signalingManager.sendOffer(friendId, offer);
    if (offerSent) {
      console.log('✅ Call offer sent via BLE');
      setSignalingStatus('Waiting for answer...');
    } else {
      console.log('❌ Failed to send offer');
      setSignalingStatus('Connection failed');
      Alert.alert('Call Failed', 'Could not connect to friend');
      endCall();
      return;
    }

    // Listen for answer
    signalingManager.on('answer', (data) => {
      if (data.from === friendId) {
        console.log('📥 Received answer from friend');
        const remoteDesc = new RTCSessionDescription(data.data.sdp);
        peerConnection.current?.setRemoteDescription(remoteDesc)
          .then(() => {
            console.log('✅ Remote description set');
            setCallState('active');
            setSignalingStatus('Connected');
          });
      }
    });

    // Simulate answer for testing (remove in production)
    setTimeout(() => {
      setCallState('active');
      setSignalingStatus('Connected (simulated)');
    }, 2000);

  } catch (error) {
    console.error('❌ Call initialization error:', error);
    Alert.alert('Call Failed', 'Could not initialize call: ' + (error as Error).message);
    endCall();
  }
};