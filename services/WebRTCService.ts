/**
 * WebRTCService — manages RTCPeerConnection lifecycle
 * Audio: DTLS-SRTP (AES-128+) via react-native-webrtc (NFR-14)
 * Signaling: TCP socket via WifiDirectModule port 9875 (FR-21, FR-22)
 * No STUN/TURN — WiFi Direct is a local routed network (NFR-16)
 */
import { MediaStream, RTCIceCandidate, RTCPeerConnection, RTCSessionDescription, mediaDevices } from 'react-native-webrtc';
import AudioStream from '../modules/AudioStream';
import WifiDirect from '../modules/WifiDirect';

export type CallRole = 'caller' | 'callee';
export interface WebRTCCallbacks {
  onConnected:    () => void;
  onDisconnected: () => void;
  onError:        (err: string) => void;
}

// react-native-webrtc has broken TS types for addEventListener due to event-target-shim
// module resolution with RN 0.73+ bundler mode. Cast to any — works fine at runtime.
type AnyPC = any;

class WebRTCService {
  private pc:           RTCPeerConnection | null = null;
  private localStream:  MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private signalSub:    any = null;
  private callbacks:    WebRTCCallbacks | null = null;
  private speakerOn:    boolean = false;

  // Audio quality bitrate map (FR-16, FR-29)
  private readonly bitrateMap = { low: 8000, medium: 16000, high: 32000 };

  async startCall(role: CallRole, callbacks: WebRTCCallbacks, speakerDefault = false, quality: 'low'|'medium'|'high' = 'high') {
    this.callbacks = callbacks;
    this.speakerOn = speakerDefault;

    try {
      await this.initPC();
      await this.addLocalAudio(quality);

      // Single listener — handles both WebRTC signals and avoids duplicates
      this.signalSub = WifiDirect.onSignalReceived(({ data }) => this.handleSignal(data));

      if (role === 'caller') await this.sendOffer();
      // callee waits for offer via handleSignal
    } catch (e: any) {
      callbacks.onError(`WebRTC startCall failed: ${e?.message ?? e}`);
    }
  }

  setMuted(muted: boolean) {
    this.localStream?.getAudioTracks().forEach(t => { t.enabled = !muted; });
  }

  setSpeaker(on: boolean) {
    this.speakerOn = on;
    AudioStream.setSpeakerOn(on);
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
    AudioStream.setSpeakerOn(false); // restore earpiece on call end
  }

  private async initPC() {
    this.pc = new RTCPeerConnection({ iceServers: [] });
    const pc = this.pc as AnyPC;

    pc.addEventListener('icecandidate', (e: any) => {
      if (!e.candidate) return;
      WifiDirect.sendSignal(JSON.stringify({ type: 'ice-candidate', candidate: e.candidate.toJSON() }))
        .catch(err => console.warn('ICE send failed:', err));
    });

    pc.addEventListener('connectionstatechange', () => {
      const state = (this.pc as AnyPC)?.connectionState;
      console.log('WebRTC connection:', state);
      if (state === 'connected') {
        AudioStream.setSpeakerOn(this.speakerOn);
        this.callbacks?.onConnected();
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        this.callbacks?.onDisconnected();
      }
    });

    pc.addEventListener('iceconnectionstatechange', () => {
      console.log('ICE state:', (this.pc as AnyPC)?.iceConnectionState);
    });

    // Remote audio track arrives here — react-native-webrtc plays it automatically
    pc.addEventListener('track', (e: any) => {
      console.log('Remote track received');
      if (!this.remoteStream) this.remoteStream = new MediaStream();
      this.remoteStream!.addTrack(e.track);
    });
  }

  private async addLocalAudio(quality: 'low'|'medium'|'high') {
    this.localStream = await mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: this.bitrateMap[quality],
      } as any,
      video: false,
    } as any);
    this.localStream.getTracks().forEach(t => (this.pc as AnyPC).addTrack(t, this.localStream!));
  }

  private async sendOffer() {
    if (!this.pc) return;
    const offer = await this.pc.createOffer({ offerToReceiveAudio: true } as any);
    await this.pc.setLocalDescription(offer);
    await WifiDirect.sendSignal(JSON.stringify({ type: 'sdp-offer', sdp: offer }));
    console.log('SDP offer sent');
  }

  private async handleOffer(sdp: any) {
    if (!this.pc) return;
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await WifiDirect.sendSignal(JSON.stringify({ type: 'sdp-answer', sdp: answer }));
    console.log('SDP answer sent');
  }

  private async handleAnswer(sdp: any) {
    if (!this.pc) return;
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    console.log('Remote SDP set');
  }

  private async handleIce(candidate: any) {
    if (!this.pc) return;
    try { await this.pc.addIceCandidate(new RTCIceCandidate(candidate)); }
    catch (e) { console.warn('addIceCandidate:', e); }
  }

  private handleSignal(raw: string) {
    try {
      const msg = JSON.parse(raw);
      switch (msg.type) {
        case 'sdp-offer':     this.handleOffer(msg.sdp); break;
        case 'sdp-answer':    this.handleAnswer(msg.sdp); break;
        case 'ice-candidate': this.handleIce(msg.candidate); break;
      }
    } catch (_) { /* non-WebRTC signal, ignore */ }
  }
}

export const webRTCService = new WebRTCService();
export default webRTCService;