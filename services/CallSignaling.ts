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

  constructor() {
    this.bleManager = new BleManager();
    this.setupListeners();
  }

  private setupListeners() {
    // Listen for signals from GATT server (when we're peripheral)
    BlePeripheral.addListener('onSignalReceived', (event: any) => {
      console.log('📥 [Server] Signal received from:', event.from);
      this.handleIncomingSignal(event.from, event.data);
    });

    // Listen for signals from GATT client (when we're central)
    BleClient.addListener('onSignalReceived', (event: any) => {
      console.log('📥 [Client] Signal received from:', event.from);
      this.handleIncomingSignal(event.from, event.data);
    });

    // Listen for GATT connections
    BleClient.addListener('onGattConnected', (event: any) => {
      console.log('✅ GATT connected:', event.deviceId);
      this.connectedDevices.add(event.deviceId);
    });

    BleClient.addListener('onGattDisconnected', (event: any) => {
      console.log('❌ GATT disconnected:', event.deviceId);
      this.connectedDevices.delete(event.deviceId);
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

      // Emit event based on message type
      this.emit(message.type, {
        from: from,
        to: message.to,
        data: message.data
      });

    } catch (error) {
      console.error('❌ Error parsing signal:', error);
    }
  }

  // Simple event system
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
      if (index > -1) {
        callbacks.splice(index, 1);
      }
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

// Connect to a device if not already connected
async ensureConnected(deviceAddress: string): Promise<boolean> {
  try {
    // Validate BLE address format (XX:XX:XX:XX:XX:XX)
    const bleAddressPattern = /^[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}$/i;
    
    if (!bleAddressPattern.test(deviceAddress)) {
      console.error('❌ Invalid BLE address format:', deviceAddress);
      console.error('Expected format: XX:XX:XX:XX:XX:XX');
      return false;
    }

    // Check if already connected
    if (this.connectedDevices.has(deviceAddress)) {
      console.log('✅ Already connected to', deviceAddress);
      return true;
    }

    console.log('🔌 Connecting to device:', deviceAddress);
    
    // Try to connect
    await BleClient.connectToDevice(deviceAddress);
    
    // Wait a bit for connection to establish
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if connected
    const connectedDevices = await BleClient.getConnectedDevices();
    const isConnected = connectedDevices.includes(deviceAddress);

    if (isConnected) {
      console.log('✅ Successfully connected to', deviceAddress);
      this.connectedDevices.add(deviceAddress);
      return true;
    } else {
      console.log('⚠️ Connection attempt completed but device not in connected list');
      return false;
    }

  } catch (error) {
    console.error('❌ Error connecting to device:', error);
    return false;
  }
}

  // Send signal via BLE GATT
  async sendSignal(deviceId: string, message: SignalingMessage): Promise<boolean> {
    try {
      console.log('📤 Sending signal:', message.type, 'to', deviceId);

      // Ensure we're connected first
      const connected = await this.ensureConnected(deviceId);
      if (!connected) {
        console.log('⚠️ Not connected to device, cannot send signal');
        return false;
      }

      // Serialize message
      const signalData = JSON.stringify(message);
      console.log('📦 Signal data size:', signalData.length, 'bytes');

      // Try sending via client first (if we initiated connection)
      try {
        await BleClient.sendSignalToDevice(deviceId, signalData);
        console.log('✅ Signal sent via BLE Client');
        return true;
      } catch (clientError) {
        console.log('⚠️ Client send failed, trying server...');
        
        // Fallback: try sending via server (if they connected to us)
        try {
          await BlePeripheral.sendSignalToDevice(deviceId, signalData);
          console.log('✅ Signal sent via BLE Server');
          return true;
        } catch (serverError) {
          console.error('❌ Both client and server send failed');
          return false;
        }
      }

    } catch (error) {
      console.error('❌ Failed to send signal:', error);
      return false;
    }
  }

  // Send call request
  async sendCallRequest(deviceId: string, fromName: string): Promise<boolean> {
    const message: SignalingMessage = {
      type: 'call-request',
      from: this.myDeviceId || 'unknown',
      to: deviceId,
      data: { callerName: fromName }
    };
    return this.sendSignal(deviceId, message);
  }

  // Send WebRTC offer
  async sendOffer(deviceId: string, offer: any): Promise<boolean> {
    const message: SignalingMessage = {
      type: 'offer',
      from: this.myDeviceId || 'unknown',
      to: deviceId,
      data: { sdp: offer }
    };
    return this.sendSignal(deviceId, message);
  }

  // Send WebRTC answer
  async sendAnswer(deviceId: string, answer: any): Promise<boolean> {
    const message: SignalingMessage = {
      type: 'answer',
      from: this.myDeviceId || 'unknown',
      to: deviceId,
      data: { sdp: answer }
    };
    return this.sendSignal(deviceId, message);
  }

  // Send ICE candidate
  async sendIceCandidate(deviceId: string, candidate: any): Promise<boolean> {
    const message: SignalingMessage = {
      type: 'ice-candidate',
      from: this.myDeviceId || 'unknown',
      to: deviceId,
      data: { candidate }
    };
    return this.sendSignal(deviceId, message);
  }

  // Send call accept
  async sendCallAccept(deviceId: string): Promise<boolean> {
    const message: SignalingMessage = {
      type: 'call-accept',
      from: this.myDeviceId || 'unknown',
      to: deviceId,
    };
    return this.sendSignal(deviceId, message);
  }

  // Send call reject
  async sendCallReject(deviceId: string): Promise<boolean> {
    const message: SignalingMessage = {
      type: 'call-reject',
      from: this.myDeviceId || 'unknown',
      to: deviceId,
    };
    return this.sendSignal(deviceId, message);
  }

  // Send call end
  async sendCallEnd(deviceId: string): Promise<boolean> {
    const message: SignalingMessage = {
      type: 'call-end',
      from: this.myDeviceId || 'unknown',
      to: deviceId,
    };
    return this.sendSignal(deviceId, message);
  }

  // Start listening for incoming signals
  startListening() {
    console.log('👂 Started listening for signals');
  }

  // Stop listening and cleanup
  stopListening() {
    console.log('🛑 Stopped listening for signals');
    this.listeners.clear();
  }

  // Disconnect from a device
  async disconnect(deviceId: string): Promise<void> {
    try {
      await BleClient.disconnectFromDevice(deviceId);
      this.connectedDevices.delete(deviceId);
      console.log('🔌 Disconnected from', deviceId);
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  }

  // Disconnect from all devices
  async disconnectAll(): Promise<void> {
    try {
      await BleClient.disconnectAll();
      this.connectedDevices.clear();
      console.log('🔌 Disconnected from all devices');
    } catch (error) {
      console.error('Error disconnecting all:', error);
    }
  }

  // Get list of connected devices
  getConnectedDevices(): string[] {
    return Array.from(this.connectedDevices);
  }
}

export const signalingManager = new CallSignalingManager();