import { NativeEventEmitter, NativeModules } from 'react-native';

const LINKING_ERROR =
  `WifiDirectModule is not linked. Make sure you rebuilt the app after adding the module.\n`;

const WifiDirectNative = NativeModules.WifiDirectModule
  ? NativeModules.WifiDirectModule
  : new Proxy({}, { get() { throw new Error(LINKING_ERROR); } });

const emitter = new NativeEventEmitter(WifiDirectNative);

export interface GroupCredentials {
  ssid: string;
  passphrase: string;
  ownerAddress: string;
}

export interface AudioReadyEvent {
  isServer: boolean;
  peerAddress: string;
}

const WifiDirect = {
  // ── Group management ──────────────────────────────────────
  /** Caller creates a group (becomes Group Owner). Returns credentials to share with callee. */
  createGroup: (): Promise<GroupCredentials> =>
    WifiDirectNative.createGroup(),

  /** Callee joins the caller's group using credentials received via BLE. */
  joinGroup: (ssid: string, passphrase: string): Promise<boolean> =>
    WifiDirectNative.joinGroup(ssid, passphrase),

  /** Tear down the group when call ends. */
  removeGroup: (): void =>
    WifiDirectNative.removeGroup(),

  // ── Audio ─────────────────────────────────────────────────
  /** Send raw PCM audio bytes (base64 encoded) over the TCP socket. */
  sendAudio: (base64Data: string): Promise<boolean> =>
    WifiDirectNative.sendAudio(base64Data),

  // ── Events ────────────────────────────────────────────────
  onGroupFormed:       (cb: (e: any) => void) => emitter.addListener('onGroupFormed', cb),
  onGroupRemoved:      (cb: (e: any) => void) => emitter.addListener('onGroupRemoved', cb),
  onAudioReady:        (cb: (e: AudioReadyEvent) => void) => emitter.addListener('onAudioSocketReady', cb),
  onAudioReceived:     (cb: (e: { data: string }) => void) => emitter.addListener('onAudioReceived', cb),
  onPeerDisconnected:  (cb: (e: any) => void) => emitter.addListener('onPeerDisconnected', cb),
  onConnectionFailed:  (cb: (e: { error: string }) => void) => emitter.addListener('onConnectionFailed', cb),

  removeAllListeners: () => {
    ['onWifiDirectStateChanged','onGroupFormed','onGroupRemoved',
     'onPeerConnected','onPeerDisconnected','onConnectionFailed',
     'onAudioSocketReady','onAudioReceived'].forEach(e => emitter.removeAllListeners(e));
  },
};

export default WifiDirect;