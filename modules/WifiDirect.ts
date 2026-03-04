import { NativeEventEmitter, NativeModules } from 'react-native';

const WifiDirectNative = NativeModules.WifiDirectModule
  ? NativeModules.WifiDirectModule
  : new Proxy({}, {
      get() { throw new Error('WifiDirectModule not linked. Rebuild the app.'); }
    });

const emitter = new NativeEventEmitter(WifiDirectNative);

export interface WifiDirectPeer {
  name: string;
  address: string;   // MAC address
  status: number;    // 0=connected, 1=invited, 2=failed, 3=available, 4=unavailable
}

export interface GroupCredentials {
  ssid: string;
  passphrase: string;
  ownerAddress: string;
}

export interface GroupFormedEvent {
  isGroupOwner: boolean;
  groupOwnerAddress: string;
}

const WifiDirect = {

  // ── Discovery ──────────────────────────────────────────────────────────────

  /** Start scanning for nearby WiFi Direct peers */
  discoverPeers: (): Promise<boolean> =>
    WifiDirectNative.discoverPeers(),

  /** Stop peer discovery (saves battery) */
  stopDiscovery: (): Promise<boolean> =>
    WifiDirectNative.stopDiscovery(),

  // ── Group / Connection ─────────────────────────────────────────────────────

  /** Caller creates a WiFi Direct group. Returns SSID + passphrase. */
  createGroup: (): Promise<GroupCredentials> =>
    WifiDirectNative.createGroup(),

  /** Connect directly to a peer by MAC address (triggers onGroupFormed) */
  connectToPeer: (deviceAddress: string): Promise<boolean> =>
    WifiDirectNative.connectToPeer(deviceAddress),

  /** Callee joins group via SSID/passphrase (Android 10+) or device address (Android 8/9) */
  joinGroup: (ssid: string, passphrase: string): Promise<boolean> =>
    WifiDirectNative.joinGroup(ssid, passphrase),

  /** Tear down the WiFi Direct group */
  removeGroup: (): void =>
    WifiDirectNative.removeGroup(),

  // ── Signaling (SDP / ICE) ─────────────────────────────────────────────────

  /** Send a signaling message (JSON string) over the TCP signaling socket (port 9875) */
  sendSignal: (message: string): Promise<boolean> =>
    WifiDirectNative.sendSignal(message),

  // ── Audio ─────────────────────────────────────────────────────────────────

  /** Send raw PCM audio (base64) over TCP audio socket (port 9876) */
  sendAudio: (base64Data: string): Promise<boolean> =>
    WifiDirectNative.sendAudio(base64Data),

  // ── Events ────────────────────────────────────────────────────────────────

  onStateChanged:     (cb: (e: { enabled: boolean }) => void)    => emitter.addListener('onWifiDirectStateChanged', cb),
  onPeersFound:       (cb: (e: { peers: WifiDirectPeer[] }) => void) => emitter.addListener('onPeersFound', cb),
  onGroupFormed:      (cb: (e: GroupFormedEvent) => void)         => emitter.addListener('onGroupFormed', cb),
  onGroupRemoved:     (cb: (e: any) => void)                      => emitter.addListener('onGroupRemoved', cb),
  onPeerDisconnected: (cb: (e: any) => void)                      => emitter.addListener('onPeerDisconnected', cb),
  onConnectionFailed: (cb: (e: { error: string }) => void)        => emitter.addListener('onConnectionFailed', cb),
  onSignalingReady:   (cb: (e: { isServer: boolean }) => void)    => emitter.addListener('onSignalingSocketReady', cb),
  onAudioReady:       (cb: (e: { isServer: boolean; peerAddress: string }) => void) => emitter.addListener('onAudioSocketReady', cb),
  onSignalReceived:   (cb: (e: { data: string }) => void)         => emitter.addListener('onSignalReceived', cb),
  onAudioReceived:    (cb: (e: { data: string }) => void)         => emitter.addListener('onAudioReceived', cb),

  removeAllListeners: () => {
    [
      'onWifiDirectStateChanged', 'onPeersFound', 'onGroupFormed', 'onGroupRemoved',
      'onPeerDisconnected', 'onConnectionFailed', 'onSignalingSocketReady',
      'onAudioSocketReady', 'onSignalReceived', 'onAudioReceived',
    ].forEach(e => emitter.removeAllListeners(e));
  },
};

export default WifiDirect;