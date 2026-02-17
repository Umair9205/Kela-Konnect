import { BleManager } from 'react-native-ble-plx';
import BleClient from '../modules/BleClient';
import BlePeripheral from '../modules/BlePeripheral';

const KELA_SERVICE_UUID = '0000FE00-0000-1000-8000-00805F9B34FB';

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'call-request' | 'call-accept' | 'call-reject' | 'call-end';
  from: string;
  to: string;
  data?: any;
}

class CallSignalingManager {
  private bleManager: BleManager;
  private listeners: Map<string, Function[]> = new Map();
  private myDeviceId: string | null = null;
  private connectedDevices: Set<string> = new Set();
  private connectionInProgress: Set<string> = new Set();

  constructor() {
    this.bleManager = new BleManager();
    this.setupListeners();
  }

  private setupListeners() {
    BlePeripheral.addListener('onSignalReceived', (event: any) => {
      console.log('📥 [Server] Signal received from:', event.from);
      this.handleIncomingSignal(event.from, event.data);
    });

    BleClient.addListener('onSignalReceived', (event: any) => {
      console.log('📥 [Client] Signal received from:', event.from);
      this.handleIncomingSignal(event.from, event.data);
    });

    BleClient.addListener('onGattConnected', (event: any) => {
      console.log('✅ GATT connected:', event.deviceId);
      this.connectedDevices.add(event.deviceId);
      this.connectionInProgress.delete(event.deviceId);
    });

    BleClient.addListener('onGattDisconnected', (event: any) => {
      console.log('❌ GATT disconnected:', event.deviceId);
      this.connectedDevices.delete(event.deviceId);
      this.connectionInProgress.delete(event.deviceId);
    });

    BlePeripheral.addListener('onDeviceConnected', (event: any) => {
      console.log('✅ Device connected to our GATT server:', event.deviceId);
      this.connectedDevices.add(event.deviceId);
    });

    BlePeripheral.addListener('onDeviceDisconnected', (event: any) => {
      console.log('❌ Device disconnected from our GATT server:', event.deviceId);
      this.connectedDevices.delete(event.deviceId);
    });
  }

  private handleIncomingSignal(from: string, data: string) {
    try {
      const message: SignalingMessage = JSON.parse(data);
      console.log(`📨 Parsed signal: ${message.type} from ${from}`);
      this.emit(message.type, {
        from: from,
        to: message.to,
        data: message.data
      });
    } catch (error) {
      console.error('❌ Error parsing signal:', error);
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) callbacks.splice(index, 1);
    }
  }

  emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  setMyDeviceId(deviceId: string) {
    this.myDeviceId = deviceId;
    console.log('📱 My device ID set to:', deviceId);
  }

  // ✅ FIX: Stop scan FIRST, then connect
  async ensureConnected(deviceAddress: string): Promise<boolean> {
    try {
      const bleAddressPattern = /^[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}$/i;
      if (!bleAddressPattern.test(deviceAddress)) {
        console.error('❌ Invalid BLE address:', deviceAddress);
        return false;
      }

      if (this.connectedDevices.has(deviceAddress)) {
        console.log('✅ Already connected to', deviceAddress);
        return true;
      }

      // Prevent duplicate connection attempts
      if (this.connectionInProgress.has(deviceAddress)) {
        console.log('⏳ Connection already in progress for', deviceAddress);
        // Wait for it to complete
        await new Promise(resolve => setTimeout(resolve, 3000));
        return this.connectedDevices.has(deviceAddress);
      }

      this.connectionInProgress.add(deviceAddress);

      // ✅ CRITICAL FIX: Stop BLE scan before connecting
      console.log('⏹️ Stopping scan before GATT connect...');
      try {
        this.bleManager.stopDeviceScan();
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        console.log('Scan was not running:', e);
      }

      console.log('🔌 Connecting to GATT:', deviceAddress);
      await BleClient.connectToDevice(deviceAddress);

      // Wait for connection with timeout
      const connected = await this.waitForConnection(deviceAddress, 5000);

      if (connected) {
        console.log('✅ GATT connection established');
        return true;
      } else {
        console.log('❌ GATT connection timeout');
        this.connectionInProgress.delete(deviceAddress);
        return false;
      }

    } catch (error) {
      console.error('❌ Error connecting:', error);
      this.connectionInProgress.delete(deviceAddress);
      return false;
    }
  }

  // Wait for connection with timeout
  private waitForConnection(deviceAddress: string, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.connectedDevices.has(deviceAddress)) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          resolve(true);
        }
      }, 200);

      const timeout = setTimeout(() => {
        clearInterval(checkInterval);
        resolve(false);
      }, timeoutMs);
    });
  }

  // ✅ FIX: Send with retry logic
  async sendSignal(deviceAddress: string, message: SignalingMessage): Promise<boolean> {
    try {
      console.log('📤 Sending signal:', message.type, 'to', deviceAddress);

      const connected = await this.ensureConnected(deviceAddress);
      if (!connected) {
        console.log('⚠️ Could not connect to device');
        return false;
      }

      const signalData = JSON.stringify(message);
      console.log('📦 Signal data size:', signalData.length, 'bytes');

      // ✅ FIX: Try server first (more reliable), then client
      try {
        await BlePeripheral.sendSignalToDevice(deviceAddress, signalData);
        console.log('✅ Signal sent via BLE Server');
        return true;
      } catch (serverError) {
        console.log('⚠️ Server send failed, trying client...');
        try {
          await BleClient.sendSignalToDevice(deviceAddress, signalData);
          console.log('✅ Signal sent via BLE Client');
          return true;
        } catch (clientError) {
          console.error('❌ Both send methods failed');
          return false;
        }
      }

    } catch (error) {
      console.error('❌ Failed to send signal:', error);
      return false;
    }
  }

  async sendCallRequest(deviceId: string, fromName: string): Promise<boolean> {
    return this.sendSignal(deviceId, {
      type: 'call-request',
      from: this.myDeviceId || 'unknown',
      to: deviceId,
      data: { callerName: fromName }
    });
  }

  async sendOffer(deviceId: string, offer: any): Promise<boolean> {
    return this.sendSignal(deviceId, {
      type: 'offer',
      from: this.myDeviceId || 'unknown',
      to: deviceId,
      data: { sdp: offer }
    });
  }

  async sendAnswer(deviceId: string, answer: any): Promise<boolean> {
    return this.sendSignal(deviceId, {
      type: 'answer',
      from: this.myDeviceId || 'unknown',
      to: deviceId,
      data: { sdp: answer }
    });
  }

  async sendIceCandidate(deviceId: string, candidate: any): Promise<boolean> {
    return this.sendSignal(deviceId, {
      type: 'ice-candidate',
      from: this.myDeviceId || 'unknown',
      to: deviceId,
      data: { candidate }
    });
  }

  async sendCallAccept(deviceId: string): Promise<boolean> {
    return this.sendSignal(deviceId, {
      type: 'call-accept',
      from: this.myDeviceId || 'unknown',
      to: deviceId,
    });
  }

  async sendCallReject(deviceId: string): Promise<boolean> {
    return this.sendSignal(deviceId, {
      type: 'call-reject',
      from: this.myDeviceId || 'unknown',
      to: deviceId,
    });
  }

  async sendCallEnd(deviceId: string): Promise<boolean> {
    return this.sendSignal(deviceId, {
      type: 'call-end',
      from: this.myDeviceId || 'unknown',
      to: deviceId,
    });
  }

  startListening() {
    console.log('👂 Started listening for signals');
  }

  stopListening() {
    console.log('🛑 Stopped listening for signals');
    this.listeners.clear();
  }

  async disconnect(deviceId: string): Promise<void> {
    try {
      await BleClient.disconnectFromDevice(deviceId);
      this.connectedDevices.delete(deviceId);
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  }

  async disconnectAll(): Promise<void> {
    try {
      await BleClient.disconnectAll();
      this.connectedDevices.clear();
    } catch (error) {
      console.error('Error disconnecting all:', error);
    }
  }

  getConnectedDevices(): string[] {
    return Array.from(this.connectedDevices);
  }
}

export const signalingManager = new CallSignalingManager();