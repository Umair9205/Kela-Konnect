/**
 * WebRTCService.ts
 *
 * Manages the WebRTC peer connection for Kela-Konnect.
 * - SDP offer/answer exchanged via WiFi Direct TCP signaling socket (port 9875)
 * - ICE candidates exchanged via same socket
 * - Audio encrypted via DTLS-SRTP (handled by WebRTC internally)
 * - No STUN/TURN — peers are on the same WiFi Direct network (local IPs)
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

class WebRTCService {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private signalSub: any = null;
  private role: CallRole = 'caller';
  private callbacks: WebRTCCallbacks | null = null;
  private isMuted = false;

  // RTCPeerConnection config — no STUN/TURN needed on local WiFi Direct network
  private readonly pcConfig = {
    iceServers: [],
    iceTransportPolicy: 'all' as RTCIceTransportPolicy,
  };

  // ── Public API ─────────────────────────────────────────────────────────────

  async startCall(role: CallRole, callbacks: WebRTCCallbacks): Promise<void> {
    this.role = role;
    this.callbacks = callbacks;

    try {
      await this.initPeerConnection();
      await this.addLocalAudio();

      // Listen for incoming signals (SDP answer / ICE from peer)
      this.signalSub = WifiDirect.onSignalReceived(({ data }) => {
        this.handleIncomingSignal(data);
      });

      if (role === 'caller') {
        // Caller creates offer after signaling socket is ready
        await this.createAndSendOffer();
      }
      // Callee waits for offer via onSignalReceived → handleIncomingSignal
    } catch (e: any) {
      callbacks.onError(`WebRTC startCall failed: ${e?.message}`);
    }
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    this.localStream?.getAudioTracks().forEach(track => {
      track.enabled = !muted;
    });
  }

  async stop() {
    this.signalSub?.remove();
    this.signalSub = null;

    this.localStream?.getTracks().forEach(t => t.stop());
    this.localStream = null;

    this.pc?.close();
    this.pc = null;

    this.callbacks = null;
    console.log('🛑 WebRTC stopped');
  }

  // ── Peer Connection Setup ──────────────────────────────────────────────────

  private async initPeerConnection() {
    this.pc = new RTCPeerConnection(this.pcConfig);

    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        const msg = JSON.stringify({ type: 'ice-candidate', candidate: candidate.toJSON() });
        WifiDirect.sendSignal(msg).catch(e => {
          console.warn('ICE send failed:', e);
        });
      }
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      console.log(`🔗 WebRTC connection state: ${state}`);
      if (state === 'connected') {
        this.callbacks?.onConnected();
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        this.callbacks?.onDisconnected();
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      console.log(`🧊 ICE state: ${this.pc?.iceConnectionState}`);
    };

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
      this.pc!.addTrack(track, this.localStream!);
    });

    console.log('🎙️ Local audio track added');
  }

  // ── Offer / Answer ─────────────────────────────────────────────────────────

  private async createAndSendOffer() {
    if (!this.pc) return;

    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    } as any);

    await this.pc.setLocalDescription(offer);

    const msg = JSON.stringify({ type: 'sdp-offer', sdp: offer });
    await WifiDirect.sendSignal(msg);
    console.log('📤 SDP offer sent');
  }

  private async handleOffer(sdp: RTCSessionDescription) {
    if (!this.pc) return;

    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    const msg = JSON.stringify({ type: 'sdp-answer', sdp: answer });
    await WifiDirect.sendSignal(msg);
    console.log('📤 SDP answer sent');
  }

  private async handleAnswer(sdp: RTCSessionDescription) {
    if (!this.pc) return;
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    console.log('✅ Remote SDP answer set');
  }

  private async handleIceCandidate(candidate: any) {
    if (!this.pc) return;
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn('ICE candidate error:', e);
    }
  }

  // ── Incoming Signal Handler ────────────────────────────────────────────────

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

        default:
          // Not a WebRTC signal — let CallSignaling handle it
          break;
      }
    } catch (e) {
      console.warn('⚠️ Invalid signal JSON:', raw.slice(0, 80));
    }
  }
}

export const webRTCService = new WebRTCService();
export default webRTCService;