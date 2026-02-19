import { router, Stack } from 'expo-router';
import React, { useEffect } from 'react';
import { signalingManager } from '../services/CallSignaling';
import { useAppStore } from '../store/appStore';

export default function RootLayout() {
  const loadFriends = useAppStore(state => state.loadFriends);
  const myDeviceId = useAppStore(state => state.myDeviceId);

  useEffect(() => {
    loadFriends();
  }, []);

  useEffect(() => {
    if (myDeviceId) {
      signalingManager.setMyDeviceId(myDeviceId);
    }
  }, [myDeviceId]);

  useEffect(() => {
    // Global listener for incoming calls
    const handleCallRequest = (data: any) => {
      console.log('📲 Incoming call from:', data.from);
      console.log('📲 Caller name:', data.data?.callerName);

      router.push({
        pathname: '/incoming-call',
        params: {
          callerId: data.from,
          callerName: data.data?.callerName || 'Unknown',
          offerSdp: '',
        }
      });
    };

    // Listen for incoming offer (actual WebRTC offer)
    const handleOffer = (data: any) => {
      console.log('📲 Incoming offer from:', data.from);

      router.push({
        pathname: '/incoming-call',
        params: {
          callerId: data.from,
          callerName: data.data?.callerName || 'Unknown Caller',
          offerSdp: JSON.stringify(data.data?.sdp),
        }
      });
    };

    signalingManager.on('call-request', handleCallRequest);
    signalingManager.on('offer', handleOffer);

    return () => {
      signalingManager.off('call-request', handleCallRequest);
      signalingManager.off('offer', handleOffer);
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