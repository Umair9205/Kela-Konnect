import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

const LINKING_ERROR =
  `The package 'BleClientModule' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You ran 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

const BleClientModule = NativeModules.BleClientModule
  ? NativeModules.BleClientModule
  : new Proxy({}, { get() { throw new Error(LINKING_ERROR); } });

const eventEmitter = new NativeEventEmitter(BleClientModule);

export interface BleClientInterface {
  connectToDevice(deviceAddress: string): Promise<boolean>;
  sendSignalToDevice(deviceAddress: string, signalData: string): Promise<boolean>;
  disconnectFromDevice(deviceAddress: string): Promise<boolean>;
  disconnectAll(): Promise<boolean>;
  getConnectedDevices(): Promise<string[]>;
  // ✅ NEW: read permanent UUID from connected device's identity characteristic
  readDeviceIdentity(deviceAddress: string): Promise<string>; // returns JSON: {"uuid":"...","name":"..."}
  addListener(
    eventType: 'onGattConnected' | 'onGattDisconnected' | 'onSignalReceived' | 'onServicesDiscovered',
    listener: (event: any) => void
  ): any;
  removeAllListeners(): void;
}

const BleClient: BleClientInterface = {
  connectToDevice: (deviceAddress) =>
    BleClientModule.connectToDevice(deviceAddress),

  sendSignalToDevice: (deviceAddress, signalData) =>
    BleClientModule.sendSignalToDevice(deviceAddress, signalData),

  disconnectFromDevice: (deviceAddress) =>
    BleClientModule.disconnectFromDevice(deviceAddress),

  disconnectAll: () =>
    BleClientModule.disconnectAll(),

  getConnectedDevices: () =>
    BleClientModule.getConnectedDevices(),

  // ✅ NEW
  readDeviceIdentity: (deviceAddress) =>
    BleClientModule.readDeviceIdentity(deviceAddress),

  addListener: (eventType, listener) =>
    eventEmitter.addListener(eventType, listener),

  removeAllListeners: () => {
    eventEmitter.removeAllListeners('onGattConnected');
    eventEmitter.removeAllListeners('onGattDisconnected');
    eventEmitter.removeAllListeners('onSignalReceived');
    eventEmitter.removeAllListeners('onServicesDiscovered');
  },
};

export default BleClient;