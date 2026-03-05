import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { registerGlobals } from 'react-native-webrtc';
import signalingManager from '../services/CallSignaling';
import { useAppStore } from '../store/appStore';

// Must be called once at startup — enables WebRTC audio session on Android
registerGlobals();

export default function RootLayout() {
  const loadData    = useAppStore(s => s.loadData);
  const myUUID      = useAppStore(s => s.myUUID);
  const isSetupDone = useAppStore(s => s.isSetupDone);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (myUUID) signalingManager.setMyUUID(myUUID);
  }, [myUUID]);

  // Redirect to setup after loadData completes on first launch
  useEffect(() => {
    if (isSetupDone === false && myUUID === null) {
      // Only redirect after a short delay to allow loadData to populate state
      const t = setTimeout(() => {
        if (!useAppStore.getState().isSetupDone) router.replace('/setup');
      }, 500);
      return () => clearTimeout(t);
    }
  }, [isSetupDone, myUUID]);

  // Global incoming call listener
  useEffect(() => {
    const handler = ({ signal }: any) => {
      router.push({
        pathname: '/incoming-call',
        params: {
          callerName: signal.data?.callerName ?? 'Unknown',
          callerUUID: signal.from ?? '',
        },
      });
    };
    signalingManager.on('call-request', handler);
    return () => { signalingManager.off('call-request', handler); };
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="setup" />
      <Stack.Screen name="discover" />
      <Stack.Screen name="friends" />
      <Stack.Screen name="history" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="call"          options={{ gestureEnabled: false }} />
      <Stack.Screen name="incoming-call" options={{ gestureEnabled: false }} />
      <Stack.Screen name="qr-code" />
      <Stack.Screen name="qr-scanner" />
    </Stack>
  );
}