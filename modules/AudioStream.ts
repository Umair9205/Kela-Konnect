/**
 * AudioStream.ts
 * 
 * JS-side audio bridge.
 * Capture: mic → base64 PCM → callback (which sends via WifiDirect.sendAudio)
 * Playback: base64 PCM received → AudioStreamNative.play()
 * 
 * The actual PCM capture and playback is handled in AudioStreamModule.kt (to be built).
 * This file is the JS bridge.
 */

import { NativeEventEmitter, NativeModules } from 'react-native';

const Native = NativeModules.AudioStreamModule
  ? NativeModules.AudioStreamModule
  : new Proxy({}, {
      get() { throw new Error('AudioStreamModule not linked. Rebuild the app.'); }
    });

const emitter = new NativeEventEmitter(Native);

let captureSubscription: any = null;
let playbackSubscription: any = null;

const AudioStream = {
  /**
   * Start capturing microphone audio.
   * onData called with base64-encoded PCM chunk every ~20ms.
   */
  startCapture(onData: (base64Pcm: string) => void) {
    Native.startCapture();
    captureSubscription = emitter.addListener('onAudioCaptured', (event: { data: string }) => {
      onData(event.data);
    });
    console.log('🎙️ AudioStream: capture started');
  },

  /**
   * Play back received audio bytes (base64 PCM).
   */
  playback(base64Pcm: string) {
    Native.playback(base64Pcm);
  },

  /**
   * Stop all audio capture and playback.
   */
  stop() {
    try { Native.stopCapture(); } catch (e) {}
    captureSubscription?.remove();
    playbackSubscription?.remove();
    captureSubscription = null;
    playbackSubscription = null;
    console.log('🛑 AudioStream: stopped');
  },

  addListener: (eventName: string) => {},
  removeListeners: (count: number) => {},
};

export default AudioStream;