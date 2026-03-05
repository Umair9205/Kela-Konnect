/**
 * CallSignaling — call-level signals over WiFi Direct TCP port 9875
 * Handles: call-request, call-accept, call-reject, call-end
 * WebRTC signals (sdp-offer/answer, ice-candidate) flow through same socket
 * but are consumed by WebRTCService, not here.
 */
import WifiDirect from '../modules/WifiDirect';

export type SignalType = 'call-request'|'call-accept'|'call-reject'|'call-end'|'sdp-offer'|'sdp-answer'|'ice-candidate';

export interface Signal {
  type: SignalType;
  from: string;
  to?:  string;
  data?: Record<string, any>;
}

type Handler = (payload: { signal: Signal }) => void;

class CallSignalingManager {
  private myUUID = '';
  private listeners = new Map<string, Set<Handler>>();
  private signalSub: any = null;
  private sigReadySub: any = null;

  constructor() {
    this.signalSub  = WifiDirect.onSignalReceived(({ data }) => this.handleRaw(data));
    this.sigReadySub = WifiDirect.onSignalingReady(() => { console.log('TCP signaling ready'); });
  }

  setMyUUID(uuid: string) { this.myUUID = uuid; }

  on(event: string, handler: Handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
  }
  off(event: string, handler: Handler) { this.listeners.get(event)?.delete(handler); }

  private emit(event: string, payload: { signal: Signal }) {
    this.listeners.get(event)?.forEach(h => { try { h(payload); } catch (e) { console.error(e); } });
  }

  private handleRaw(raw: string) {
    try {
      const signal: Signal = JSON.parse(raw);
      if (!signal.type) return;
      // Skip WebRTC signals — handled by WebRTCService
      if (['sdp-offer','sdp-answer','ice-candidate'].includes(signal.type)) return;
      console.log(`Signal: ${signal.type} from ${signal.from}`);
      this.emit(signal.type, { signal });
    } catch (_) {}
  }

  async send(signal: Signal): Promise<boolean> {
    try { await WifiDirect.sendSignal(JSON.stringify(signal)); return true; }
    catch (e) { console.error('send failed:', e); return false; }
  }

  sendCallRequest(peerUUID: string, callerName: string) {
    return this.send({ type:'call-request', from:this.myUUID, to:peerUUID, data:{ callerName } });
  }
  sendCallAccept(peerUUID: string, myName: string) {
    return this.send({ type:'call-accept', from:this.myUUID, to:peerUUID, data:{ callerName:myName } });
  }
  sendCallReject(peerUUID: string) {
    return this.send({ type:'call-reject', from:this.myUUID, to:peerUUID });
  }
  sendCallEnd(peerUUID: string) {
    return this.send({ type:'call-end', from:this.myUUID, to:peerUUID });
  }

  destroy() {
    this.signalSub?.remove();
    this.sigReadySub?.remove();
    this.listeners.clear();
  }
}

export const signalingManager = new CallSignalingManager();
export default signalingManager;