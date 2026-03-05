import { NativeEventEmitter, NativeModules } from 'react-native';

const Native = NativeModules.AudioStreamModule ?? new Proxy({}, {
  get() { throw new Error('AudioStreamModule not linked. Run: expo run:android'); }
});
const emitter = new NativeEventEmitter(Native);

const AudioStream = {
  startCapture(onData: (b64: string) => void) {
    Native.startCapture();
    return emitter.addListener('onAudioCaptured', (e: { data: string }) => onData(e.data));
  },
  stopCapture:  ()                    => Native.stopCapture(),
  playback:     (b64: string)         => Native.playback(b64),
  setMuted:     (m: boolean)          => Native.setMuted(m),
  isMuted:      (): Promise<boolean>  => Native.isMuted(),
  setSpeakerOn: (on: boolean)         => Native.setSpeakerOn(on),
  isSpeakerOn:  (): Promise<boolean>  => Native.isSpeakerOn(),
};

export default AudioStream;