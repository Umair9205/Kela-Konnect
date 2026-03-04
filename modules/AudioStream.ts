import { NativeEventEmitter, NativeModules } from 'react-native';

const Native = NativeModules.AudioStreamModule
  ? NativeModules.AudioStreamModule
  : new Proxy({}, {
      get() { throw new Error('AudioStreamModule not linked. Rebuild the app.'); }
    });

const emitter = new NativeEventEmitter(Native);

let captureSubscription: any = null;

const AudioStream = {

  /** Start mic capture. onData called with base64 PCM every ~20ms. */
  startCapture(onData: (base64Pcm: string) => void) {
    Native.startCapture();
    captureSubscription = emitter.addListener('onAudioCaptured', (e: { data: string }) => {
      onData(e.data);
    });
    console.log('🎙️ AudioStream: capture started');
  },

  /** Play received base64 PCM audio */
  playback(base64Pcm: string) {
    Native.playback(base64Pcm);
  },

  /** Stop capture and playback */
  stop() {
    try { Native.stopCapture(); } catch (_) {}
    captureSubscription?.remove();
    captureSubscription = null;
    console.log('🛑 AudioStream: stopped');
  },

  /** Mute/unmute mic (capture continues, data is dropped in native layer) */
  setMuted(muted: boolean) {
    Native.setMuted(muted);
  },

  isMuted(): Promise<boolean> {
    return Native.isMuted();
  },

  /** Toggle speaker vs earpiece */
  setSpeakerOn(speakerOn: boolean) {
    Native.setSpeakerOn(speakerOn);
  },

  isSpeakerOn(): Promise<boolean> {
    return Native.isSpeakerOn();
  },

  addListener: (_: string) => {},
  removeListeners: (_: number) => {},
};

export default AudioStream;