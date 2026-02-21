import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

const LINKING_ERROR =
  `The package 'BlePeripheralModule' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You ran 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

const BlePeripheralModule = NativeModules.BlePeripheralModule
  ? NativeModules.BlePeripheralModule
  : new Proxy({}, { get() { throw new Error(LINKING_ERROR); } });

const eventEmitter = new NativeEventEmitter(BlePeripheralModule);

export interface BlePeripheralInterface {
  startAdvertising(deviceName: string, serviceUuid: string): Promise<void>;
  stopAdvertising(): Promise<boolean>;
  isAdvertising(): Promise<boolean>;
  sendSignalToDevice(deviceAddress: string, signalData: string): Promise<boolean>;
  // ✅ NEW: set permanent UUID into the identity characteristic
  setDeviceUUID(uuid: string, name: string): void;
  addListener(
    eventType: 'onAdvertisingStarted' | 'onAdvertisingFailed' | 'onAdvertisingStopped' | 'onSignalReceived' | 'onDeviceConnected' | 'onDeviceDisconnected',
    listener: (event: any) => void
  ): any;
  removeAllListeners(): void;
}

const BlePeripheral: BlePeripheralInterface = {
  startAdvertising: (deviceName, serviceUuid) =>
    BlePeripheralModule.startAdvertising(deviceName, serviceUuid),

  stopAdvertising: () =>
    BlePeripheralModule.stopAdvertising(),

  isAdvertising: () =>
    BlePeripheralModule.isAdvertising(),

  sendSignalToDevice: (deviceAddress, signalData) =>
    BlePeripheralModule.sendSignalToDevice(deviceAddress, signalData),

  // ✅ NEW
  setDeviceUUID: (uuid, name) =>
    BlePeripheralModule.setDeviceUUID(uuid, name),

  addListener: (eventType, listener) =>
    eventEmitter.addListener(eventType, listener),

  removeAllListeners: () => {
    eventEmitter.removeAllListeners('onAdvertisingStarted');
    eventEmitter.removeAllListeners('onAdvertisingFailed');
    eventEmitter.removeAllListeners('onAdvertisingStopped');
    eventEmitter.removeAllListeners('onSignalReceived');
    eventEmitter.removeAllListeners('onDeviceConnected');
    eventEmitter.removeAllListeners('onDeviceDisconnected');
  },
};

export default BlePeripheral;