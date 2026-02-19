import { BleManager } from 'react-native-ble-plx';
import BleClient from '../modules/BleClient';
import BlePeripheral from '../modules/BlePeripheral';

const KELA_SERVICE_UUID = '0000FE00-0000-1000-8000-00805F9B34FB';
const MAX_CHUNK_SIZE = 350; // ✅ Reduced to 350 bytes (safer)

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'call-request' | 'call-accept' | 'call-reject' | 'call-end' | 'chunk';
  from: string;
  to: string;
  data?: any;
  chunkId?: string;
  chunkIndex?: number;
  totalChunks?: number;
  originalType?: string;
}

interface ChunkBuffer {
  chunks: Map<number, string>;
  totalChunks: number;
  originalType: string;
  timestamp: number;
}

class CallSignalingManager {
  private bleManager: BleManager;
  private listeners: Map<string, Function[]> = new Map();
  private myDeviceId: string | null = null;
  private connectedDevices: Set<string> = new Set();
  private connectionInProgress: Set<string> = new Set();
  private chunkBuffers: Map<string, ChunkBuffer> = new Map();

  constructor() {
    this.bleManager = new BleManager();
    this.setupListeners();
    this.startChunkCleanup();
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
      
      if (message.type === 'chunk') {
        this.handleChunk(from, message);
        return;
      }

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

  private handleChunk(from: string, message: SignalingMessage) {
    const { chunkId, chunkIndex, totalChunks, data, originalType } = message;
    
    if (!chunkId || chunkIndex === undefined || !totalChunks || !originalType) {
      console.error('❌ Invalid chunk message');
      return;
    }

    if (!this.chunkBuffers.has(chunkId)) {
      this.chunkBuffers.set(chunkId, {
        chunks: new Map(),
        totalChunks,
        originalType,
        timestamp: Date.now()
      });
    }

    const buffer = this.chunkBuffers.get(chunkId)!;
    buffer.chunks.set(chunkIndex, data);

    console.log(`📦 Received chunk ${chunkIndex + 1}/${totalChunks} for ${originalType}`);

    if (buffer.chunks.size === totalChunks) {
      console.log('✅ All chunks received, reassembling...');
      
      let fullData = '';
      for (let i = 0; i < totalChunks; i++) {
        fullData += buffer.chunks.get(i) || '';
      }

      try {
        const completeMessage = JSON.parse(fullData);
        console.log(`📨 Reassembled ${originalType} from ${from}`);
        this.emit(originalType, {
          from: from,
          to: completeMessage.to,
          data: completeMessage.data
        });
      } catch (error) {
        console.error('❌ Error parsing reassembled message:', error);
      }

      this.chunkBuffers.delete(chunkId);
    }
  }

  private startChunkCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [chunkId, buffer] of this.chunkBuffers.entries()) {
        if (now - buffer.timestamp > 30000) {
          console.log('🧹 Cleaning up expired chunk buffer:', chunkId);
          this.chunkBuffers.delete(chunkId);
        }
      }
    }, 30000);
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

      if (this.connectionInProgress.has(deviceAddress)) {
        console.log('⏳ Connection already in progress for', deviceAddress);
        await new Promise(resolve => setTimeout(resolve, 3000));
        return this.connectedDevices.has(deviceAddress);
      }

      this.connectionInProgress.add(deviceAddress);

      console.log('⏹️ Stopping scan before GATT connect...');
      try {
        const state = await this.bleManager.state();
        if (state === 'PoweredOn') {
          this.bleManager.stopDeviceScan();
          await new Promise(resolve => setTimeout(resolve, 800));
          console.log('✅ Scan stopped successfully');
        }
      } catch (scanError) {
        console.log('ℹ️ Scan stop not needed:', scanError);
      }

      console.log('🔌 Connecting to GATT:', deviceAddress);
      
      try {
        await BleClient.connectToDevice(deviceAddress);
      } catch (connectError) {
        console.error('❌ Connection initiation failed:', connectError);
        this.connectionInProgress.delete(deviceAddress);
        return false;
      }

      const connected = await this.waitForConnection(deviceAddress, 5000);

      if (connected) {
        console.log('✅ GATT connection established');
        return true;
      } else {
        console.log('❌ GATT connection timeout');
        this.connectionInProgress.delete(deviceAddress);
        try {
          await BleClient.disconnectFromDevice(deviceAddress);
        } catch (e) {}
        return false;
      }

    } catch (error) {
      console.error('❌ Error in ensureConnected:', error);
      this.connectionInProgress.delete(deviceAddress);
      return false;
    }
  }

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

      if (signalData.length > MAX_CHUNK_SIZE) {
        console.log('📦 Data too large, chunking into smaller pieces...');
        return await this.sendChunked(deviceAddress, message, signalData);
      }

      try {
        await BlePeripheral.sendSignalToDevice(deviceAddress, signalData);
        console.log('✅ Signal sent via BLE Server');
        return true;
      } catch (serverError) {
        console.log('⚠️ Server send failed:', serverError);
        try {
          await BleClient.sendSignalToDevice(deviceAddress, signalData);
          console.log('✅ Signal sent via BLE Client');
          return true;
        } catch (clientError) {
          console.error('❌ Both send methods failed:', clientError);
          return false;
        }
      }

    } catch (error) {
      console.error('❌ Failed to send signal:', error);
      return false;
    }
  }

  // ✅ UPDATED: Better error handling and logging
  private async sendChunked(deviceAddress: string, message: SignalingMessage, fullData: string): Promise<boolean> {
    const chunkId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const chunks: string[] = [];
    
    for (let i = 0; i < fullData.length; i += MAX_CHUNK_SIZE) {
      chunks.push(fullData.substring(i, i + MAX_CHUNK_SIZE));
    }

    console.log(`📦 Sending ${chunks.length} chunks for ${message.type}`);

    for (let i = 0; i < chunks.length; i++) {
      const chunkMessage: SignalingMessage = {
        type: 'chunk',
        from: this.myDeviceId || 'unknown',
        to: deviceAddress,
        chunkId,
        chunkIndex: i,
        totalChunks: chunks.length,
        originalType: message.type,
        data: chunks[i]
      };

      const chunkData = JSON.stringify(chunkMessage);
      console.log(`📦 Chunk ${i + 1}/${chunks.length} size: ${chunkData.length} bytes`);
      
      // ✅ CRITICAL: Verify chunk isn't too large
      if (chunkData.length > 500) {
        console.error(`❌ Chunk ${i + 1} is too large: ${chunkData.length} bytes`);
        return false;
      }

      let sent = false;
      
      try {
        await BlePeripheral.sendSignalToDevice(deviceAddress, chunkData);
        console.log(`✅ Chunk ${i + 1}/${chunks.length} sent via server`);
        sent = true;
      } catch (serverError: any) {
        console.log(`⚠️ Server failed for chunk ${i + 1}:`, serverError?.message || serverError);
        
        try {
          await BleClient.sendSignalToDevice(deviceAddress, chunkData);
          console.log(`✅ Chunk ${i + 1}/${chunks.length} sent via client`);
          sent = true;
        } catch (clientError: any) {
          console.error(`❌ Both methods failed for chunk ${i + 1}:`, clientError?.message || clientError);
        }
      }

      if (!sent) {
        console.error(`❌ Failed to send chunk ${i + 1}/${chunks.length}`);
        return false;
      }

      // ✅ Longer delay between chunks
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('✅ All chunks sent successfully');
    return true;
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