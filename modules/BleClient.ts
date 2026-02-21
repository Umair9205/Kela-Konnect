import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

const LINKING_ERROR =
  `The package 'BleClientModule' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You ran 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

const BleClientModule = NativeModules.BleClientModule
  ? NativeModules.BleClientModule
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

const eventEmitter = new NativeEventEmitter(BleClientModule);

export interface BleClientInterface {
  connectToDevice(deviceAddress: string): Promise<boolean>;
  sendSignalToDevice(deviceAddress: string, signalData: string): Promise<boolean>;
  disconnectFromDevice(deviceAddress: string): Promise<boolean>;
  disconnectAll(): Promise<boolean>;
  getConnectedDevices(): Promise<string[]>;
  readDeviceIdentity(deviceAddress: string): Promise<string>;
  addListener(
    eventType: 'onGattConnected' | 'onGattDisconnected' | 'onSignalReceived' | 'onServicesDiscovered',
    listener: (event: any) => void
  ): any;
  removeAllListeners(): void;
}

const BleClient: BleClientInterface = {
  connectToDevice: (deviceAddress: string) => {
    return BleClientModule.connectToDevice(deviceAddress);
  },

  sendSignalToDevice: (deviceAddress: string, signalData: string) => {
    return BleClientModule.sendSignalToDevice(deviceAddress, signalData);
  },

  readDeviceIdentity: (deviceAddress: string) => {
    return BleClientModule.readDeviceIdentity(deviceAddress);
  },

  disconnectFromDevice: (deviceAddress: string) => {
    return BleClientModule.disconnectFromDevice(deviceAddress);
  },

  disconnectAll: () => {
    return BleClientModule.disconnectAll();
  },

  getConnectedDevices: () => {
    return BleClientModule.getConnectedDevices();
  },

  addListener: (eventType, listener) => {
    return eventEmitter.addListener(eventType, listener);
  },

  removeAllListeners: () => {
    eventEmitter.removeAllListeners('onGattConnected');
    eventEmitter.removeAllListeners('onGattDisconnected');
    eventEmitter.removeAllListeners('onSignalReceived');
    eventEmitter.removeAllListeners('onServicesDiscovered');
  },
};

export default BleClient;