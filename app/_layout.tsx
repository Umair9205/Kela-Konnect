import { router, Stack } from 'expo-router';
import React, { useEffect } from 'react';
import { Signal, signalingManager } from '../services/CallSignaling';
import { useAppStore } from '../store/appStore';

export default function RootLayout() {
  const loadData = useAppStore(state => state.loadData);
  const myUUID = useAppStore(state => state.myUUID);

  useEffect(() => {
    // Always load stored identity on app start
    // This ensures UUID is set even if user never opened ble-advertise
    loadData();
  }, []);

  useEffect(() => {
    if (myUUID) {
      signalingManager.setMyUUID(myUUID);
      console.log('📱 SignalingManager identity set:', myUUID);
    }
  }, [myUUID]);

  useEffect(() => {
    // Global listener for incoming calls
    // { signal: Signal, fromMac: string }
    const handleCallRequest = ({ signal, fromMac }: { signal: Signal; fromMac: string }) => {
      console.log('📲 Incoming call-request from UUID:', signal.from, 'MAC:', fromMac);
      console.log('📲 Caller name:', signal.data?.callerName);

      router.push({
        pathname: '/incoming-call',
        params: {
          callerId: signal.from,           // caller's permanent UUID
          callerName: signal.data?.callerName || 'Unknown',
          callerMac: fromMac,              // caller's current MAC for sending reply
        }
      });
    };

    signalingManager.on('call-request', handleCallRequest);

    return () => {
      signalingManager.off('call-request', handleCallRequest);
    };
  }, []);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="ble-test" options={{ title: 'Scan for Users' }} />
      <Stack.Screen name="ble-advertise" options={{ title: 'Broadcast Presence' }} />
      <Stack.Screen name="friends" options={{ title: 'Friends' }} />
      <Stack.Screen name="call" options={{ headerShown: false }} />
      <Stack.Screen name="incoming-call" options={{ headerShown: false }} />
      <Stack.Screen name="qr-code" options={{ title: 'My QR Code' }} />
      <Stack.Screen name="qr-scanner" options={{ title: 'Scan QR Code' }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}