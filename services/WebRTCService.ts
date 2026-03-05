/**
 * WebRTCService.ts
 *
 * WebRTC peer connection for Kela-Konnect.
 * Transport: WiFi Direct (local network, no STUN/TURN needed)
 * Signaling: TCP socket via WifiDirectModule (port 9875)
 * Audio: DTLS-SRTP encrypted via WebRTC
 */

import {
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
} from 'react-native-webrtc';
import WifiDirect from '../modules/WifiDirect';

type CallRole = 'caller' | 'callee';

interface WebRTCCallbacks {
  onConnected: () => void;
  onDisconnected: () => void;
  onError: (err: string) => void;
}

// ✅ Cast pc to any for event handlers — known react-native-webrtc TS bug
// with RN 0.73+ bundler module resolution breaking event-target-shim types.
// addEventListener works fine at runtime. Tracked: github.com/react-native-webrtc/react-native-webrtc/issues/1544
type AnyPC = any;

class WebRTCService {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private signalSub: any = null;
  private role: CallRole = 'caller';
  private callbacks: WebRTCCallbacks | null = null;

  private readonly pcConfig = {
    iceServers: [],  // No STUN/TURN — WiFi Direct is a local network
  };

  // ── Public API ─────────────────────────────────────────────────────────────

  async startCall(role: CallRole, callbacks: WebRTCCallbacks): Promise<void> {
    this.role = role;
    this.callbacks = callbacks;

    try {
      await this.initPeerConnection();
      await this.addLocalAudio();

      // Listen for incoming signals (SDP + ICE) over TCP
      this.signalSub = WifiDirect.onSignalReceived(({ data }) => {
        this.handleIncomingSignal(data);
      });

      if (role === 'caller') {
        await this.createAndSendOffer();
      }
      // Callee waits — offer arrives via onSignalReceived
    } catch (e: any) {
      callbacks.onError(`WebRTC startCall failed: ${e?.message ?? e}`);
    }
  }

  setMuted(muted: boolean) {
    this.localStream?.getAudioTracks().forEach(track => {
      track.enabled = !muted;
    });
  }

  async stop() {
    this.signalSub?.remove();
    this.signalSub = null;

    this.localStream?.getTracks().forEach(t => t.stop());
    this.localStream = null;
    this.remoteStream = null;

    this.pc?.close();
    this.pc = null;

    this.callbacks = null;
    console.log('🛑 WebRTC stopped');
  }

  // ── Peer Connection ────────────────────────────────────────────────────────

  private async initPeerConnection() {
    this.pc = new RTCPeerConnection(this.pcConfig);
    const pc = this.pc as AnyPC; // ✅ bypass broken TS types for event handlers

    pc.addEventListener('icecandidate', (event: any) => {
      if (!event.candidate) return; // null = gathering complete
      const msg = JSON.stringify({
        type: 'ice-candidate',
        candidate: event.candidate.toJSON(),
      });
      WifiDirect.sendSignal(msg).catch((e: any) => console.warn('ICE send failed:', e));
    });

    pc.addEventListener('connectionstatechange', () => {
      const state = (this.pc as AnyPC)?.connectionState;
      console.log(`🔗 Connection state: ${state}`);
      switch (state) {
        case 'connected':
          this.callbacks?.onConnected();
          break;
        case 'disconnected':
        case 'failed':
        case 'closed':
          this.callbacks?.onDisconnected();
          break;
      }
    });

    pc.addEventListener('iceconnectionstatechange', () => {
      console.log(`🧊 ICE state: ${(this.pc as AnyPC)?.iceConnectionState}`);
    });

    // Receive remote audio track
    pc.addEventListener('track', (event: any) => {
      console.log('🔊 Remote track received');
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }
      this.remoteStream!.addTrack(event.track);
    });

    console.log('✅ RTCPeerConnection initialized');
  }

  private async addLocalAudio() {
    this.localStream = await mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000,
      },
      video: false,
    });

    this.localStream.getTracks().forEach(track => {
      (this.pc as AnyPC).addTrack(track, this.localStream!);
    });

    console.log('🎙️ Local audio track added');
  }

  // ── Offer / Answer ─────────────────────────────────────────────────────────

  private async createAndSendOffer() {
    if (!this.pc) return;
    const offer = await this.pc.createOffer({ offerToReceiveAudio: true } as any);
    await this.pc.setLocalDescription(offer);
    await WifiDirect.sendSignal(JSON.stringify({ type: 'sdp-offer', sdp: offer }));
    console.log('📤 SDP offer sent');
  }

  private async handleOffer(sdp: any) {
    if (!this.pc) return;
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await WifiDirect.sendSignal(JSON.stringify({ type: 'sdp-answer', sdp: answer }));
    console.log('📤 SDP answer sent');
  }

  private async handleAnswer(sdp: any) {
    if (!this.pc) return;
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    console.log('✅ Remote SDP answer set');
  }

  private async handleIceCandidate(candidate: any) {
    if (!this.pc) return;
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn('addIceCandidate error:', e);
    }
  }

  // ── Signal Handler ─────────────────────────────────────────────────────────

  private handleIncomingSignal(raw: string) {
    try {
      const msg = JSON.parse(raw);
      switch (msg.type) {
        case 'sdp-offer':
          console.log('📥 SDP offer received');
          this.handleOffer(msg.sdp);
          break;
        case 'sdp-answer':
          console.log('📥 SDP answer received');
          this.handleAnswer(msg.sdp);
          break;
        case 'ice-candidate':
          this.handleIceCandidate(msg.candidate);
          break;
        // call-request/accept/reject/end handled by CallSignaling, not here
      }
    } catch (_) {
      // Not JSON or not a WebRTC signal
    }
  }
}

export const webRTCService = new WebRTCService();
export default webRTCService;