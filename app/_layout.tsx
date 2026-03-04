import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { signalingManager } from '../services/CallSignaling';
import { useAppStore } from '../store/appStore';

export default function RootLayout() {
  const loadData = useAppStore(s => s.loadData);
  const myUUID   = useAppStore(s => s.myUUID);

  useEffect(() => {
    loadData();
  }, []);

  // Set UUID on signalingManager once loaded
  useEffect(() => {
    if (myUUID) {
      signalingManager.setMyUUID(myUUID);
    }
  }, [myUUID]);

  useEffect(() => {
    // Listen for incoming call-requests over WiFi Direct TCP signaling
    // This only fires after a WiFi Direct group is already formed
    // (i.e. someone connected to us and sent a call-request)
    const handler = ({ signal }: any) => {
      const callerName = signal.data?.callerName ?? 'Unknown';
      const callerUUID = signal.from ?? '';
      router.push({
        pathname: '/incoming-call',
        params: { callerName, callerUUID },
      });
    };

    signalingManager.on('call-request', handler);
    return () => {
      signalingManager.off('call-request', handler);
    };
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="discover" />
      <Stack.Screen name="friends" />
      <Stack.Screen name="call"          options={{ gestureEnabled: false }} />
      <Stack.Screen name="incoming-call" options={{ gestureEnabled: false }} />
      <Stack.Screen name="qr-code" />
      <Stack.Screen name="qr-scanner" />
    </Stack>
  );
}