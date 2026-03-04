/**
 * CallSignaling.ts
 *
 * Call-level signaling over WiFi Direct TCP socket (port 9875).
 * Handles: call-request, call-accept, call-reject, call-end
 *
 * Flow:
 *   Caller: discoverPeers → connectToPeer → onGroupFormed → TCP ready
 *           → sendCallRequest → wait for call-accept → WebRTC startCall('caller')
 *
 *   Callee: onGroupFormed (auto) → TCP ready
 *           → receives call-request → UI shows incoming call
 *           → sendCallAccept → WebRTC startCall('callee')
 */

import WifiDirect from '../modules/WifiDirect';

export type SignalType = 'call-request' | 'call-accept' | 'call-reject' | 'call-end' | 'sdp-offer' | 'sdp-answer' | 'ice-candidate';

export interface Signal {
  type: SignalType;
  from: string;       // sender's permanent UUID
  to?: string;        // recipient UUID (optional, broadcast to whoever is connected)
  data?: Record<string, any>;
}

type SignalHandler = (payload: { signal: Signal }) => void;

class CallSignalingManager {
  private myUUID: string = '';
  private listeners: Map<string, Set<SignalHandler>> = new Map();
  private signalSub: any = null;
  private signalingReady = false;
  private queuedSignals: string[] = [];

  constructor() {
    // Listen for incoming TCP signals
    this.signalSub = WifiDirect.onSignalReceived(({ data }) => {
      this.handleRaw(data);
    });

    // Track when signaling socket is ready
    WifiDirect.onSignalingReady(() => {
      this.signalingReady = true;
      console.log('📶 Signaling TCP socket ready');
      // Flush any queued signals
      this.queuedSignals.forEach(msg => {
        WifiDirect.sendSignal(msg).catch(e => console.warn('Queue flush error:', e));
      });
      this.queuedSignals = [];
    });
  }

  setMyUUID(uuid: string) {
    this.myUUID = uuid;
  }

  // ── Event emitter ──────────────────────────────────────────────────────────

  on(event: string, handler: SignalHandler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
  }

  off(event: string, handler: SignalHandler) {
    this.listeners.get(event)?.delete(handler);
  }

  private emit(event: string, payload: { signal: Signal }) {
    this.listeners.get(event)?.forEach(h => {
      try { h(payload); } catch (e) { console.error('Signal handler error:', e); }
    });
  }

  // ── Raw signal handler ─────────────────────────────────────────────────────

  private handleRaw(raw: string) {
    try {
      const signal: Signal = JSON.parse(raw);
      if (!signal.type) return;

      // WebRTC signals are handled by WebRTCService — skip them here
      if (['sdp-offer', 'sdp-answer', 'ice-candidate'].includes(signal.type)) return;

      console.log(`📨 Call signal: ${signal.type} from ${signal.from}`);
      this.emit(signal.type, { signal });
    } catch (_) {
      // Not JSON or not a call signal — ignore
    }
  }

  // ── Send ───────────────────────────────────────────────────────────────────

  async sendSignal(signal: Signal): Promise<boolean> {
    const payload = JSON.stringify(signal);
    try {
      await WifiDirect.sendSignal(payload);
      return true;
    } catch (e) {
      console.error('sendSignal failed:', e);
      return false;
    }
  }

  async sendCallRequest(peerUUID: string, callerName: string): Promise<boolean> {
    return this.sendSignal({
      type: 'call-request',
      from: this.myUUID,
      to: peerUUID,
      data: { callerName },
    });
  }

  async sendCallAccept(peerUUID: string, myName: string): Promise<boolean> {
    return this.sendSignal({
      type: 'call-accept',
      from: this.myUUID,
      to: peerUUID,
      data: { callerName: myName },
    });
  }

  async sendCallReject(peerUUID: string): Promise<boolean> {
    return this.sendSignal({
      type: 'call-reject',
      from: this.myUUID,
      to: peerUUID,
    });
  }

  async sendCallEnd(peerUUID: string): Promise<boolean> {
    return this.sendSignal({
      type: 'call-end',
      from: this.myUUID,
      to: peerUUID,
    });
  }

  destroy() {
    this.signalSub?.remove();
    this.listeners.clear();
  }
}

export const signalingManager = new CallSignalingManager();
export type { CallSignalingManager };
