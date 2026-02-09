import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

const LINKING_ERROR =
  `The package 'BlePeripheralModule' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You ran 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

const BlePeripheralModule = NativeModules.BlePeripheralModule
  ? NativeModules.BlePeripheralModule
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

const eventEmitter = new NativeEventEmitter(BlePeripheralModule);

export interface BlePeripheralInterface {
  startAdvertising(deviceName: string, serviceUuid: string): Promise<void>;
  stopAdvertising(): Promise<boolean>;
  isAdvertising(): Promise<boolean>;
  addListener(
    eventType: 'onAdvertisingStarted' | 'onAdvertisingFailed' | 'onAdvertisingStopped',
    listener: (event: any) => void
  ): any;
  removeAllListeners(): void;
}

const BlePeripheral: BlePeripheralInterface = {
  startAdvertising: (deviceName: string, serviceUuid: string) => {
    return BlePeripheralModule.startAdvertising(deviceName, serviceUuid);
  },

  stopAdvertising: () => {
    return BlePeripheralModule.stopAdvertising();
  },

  isAdvertising: () => {
    return BlePeripheralModule.isAdvertising();
  },

  addListener: (eventType, listener) => {
    return eventEmitter.addListener(eventType, listener);
  },

  removeAllListeners: () => {
    eventEmitter.removeAllListeners('onAdvertisingStarted');
    eventEmitter.removeAllListeners('onAdvertisingFailed');
    eventEmitter.removeAllListeners('onAdvertisingStopped');
  },
};

export default BlePeripheral;