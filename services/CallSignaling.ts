import BleClient from '../modules/BleClient';
import BlePeripheral from '../modules/BlePeripheral';

const MAX_BLE_WRITE = 400;

export type SignalType =
  | 'call-request'
  | 'call-accept'
  | 'call-reject'
  | 'call-end';

export interface Signal {
  type: SignalType;
  from: string;
  to: string;
  data?: any;
}

class CallSignalingManager {
  private myUUID: string | null = null;
  private listeners = new Map<string, Function[]>();

  constructor() {
    this.setupListeners();
  }

  private setupListeners() {
    BlePeripheral.addListener('onSignalReceived', (event: any) => {
      console.log('📥 Signal received from MAC:', event.from);
      this.handleIncoming(event.from, event.data);
    });

    BleClient.addListener('onGattConnected', (event: any) => {
      console.log('✅ GATT connected:', event.deviceId);
    });

    BleClient.addListener('onGattDisconnected', (event: any) => {
      console.log('❌ GATT disconnected:', event.deviceId);
    });

    BlePeripheral.addListener('onDeviceConnected', (event: any) => {
      console.log('✅ Device connected to our server:', event.deviceId);
    });

    BlePeripheral.addListener('onDeviceDisconnected', (event: any) => {
      console.log('❌ Device left our server:', event.deviceId);
    });
  }

  setMyUUID(uuid: string) {
    this.myUUID = uuid;
    console.log('📱 SignalingManager UUID:', uuid);
  }

  async sendSignal(currentMac: string, signal: Signal): Promise<boolean> {
    if (!this.myUUID) {
      console.error('❌ myUUID not set');
      return false;
    }

    const payload = JSON.stringify(signal);
    if (payload.length > MAX_BLE_WRITE) {
      console.error(`❌ Signal too large: ${payload.length}b`);
      return false;
    }

    console.log(`📤 ${signal.type} → MAC ${currentMac} (${payload.length}b)`);

    try {
      await BleClient.connectToDevice(currentMac);
      // connectToDevice now resolves ONLY after service discovery completes
      await BleClient.sendSignalToDevice(currentMac, payload);
      console.log(`✅ ${signal.type} sent`);
      return true;
    } catch (err: any) {
      console.error(`❌ Send failed:`, err?.message || err);
      return false;
    }
  }

  async sendCallRequest(currentMac: string, toUUID: string, callerName: string): Promise<boolean> {
    return this.sendSignal(currentMac, {
      type: 'call-request',
      from: this.myUUID!,
      to: toUUID,
      data: { callerName },
    });
  }

  // Callee sends this as ACK — no wifi creds yet, caller will send those separately
  async sendCallAccept(currentMac: string, toUUID: string, calleeName: string): Promise<boolean> {
    return this.sendSignal(currentMac, {
      type: 'call-accept',
      from: this.myUUID!,
      to: toUUID,
      data: { calleeName },
    });
  }

  async sendCallReject(currentMac: string, toUUID: string): Promise<boolean> {
    return this.sendSignal(currentMac, {
      type: 'call-reject',
      from: this.myUUID!,
      to: toUUID,
    });
  }

  async sendCallEnd(currentMac: string, toUUID: string): Promise<boolean> {
    return this.sendSignal(currentMac, {
      type: 'call-end',
      from: this.myUUID!,
      to: toUUID,
    });
  }

  private handleIncoming(fromMac: string, rawData: string) {
    try {
      const signal: Signal = JSON.parse(rawData);
      console.log(`📨 ${signal.type} from UUID ${signal.from}`);
      this.emit(signal.type, { signal, fromMac });
    } catch (e) {
      console.error('❌ Parse error:', e);
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function) {
    const cbs = this.listeners.get(event);
    if (cbs) {
      const i = cbs.indexOf(callback);
      if (i > -1) cbs.splice(i, 1);
    }
  }

  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }
}

export const signalingManager = new CallSignalingManager();