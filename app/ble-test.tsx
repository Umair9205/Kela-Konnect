import * as ExpoDevice from 'expo-device';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Button, FlatList, PermissionsAndroid,
  Platform, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import BleClient from '../modules/BleClient';
import { useAppStore } from '../store/appStore';

const KELA_SERVICE_UUID = '0000FE00-0000-1000-8000-00805F9B34FB';

interface KelaDevice {
  id: string;        // current BLE MAC (temporary, changes with rotation)
  uuid?: string;     // permanent UUID (read from identity characteristic)
  name: string;
  rssi: number;
  lastSeen: Date;
  isFriend: boolean;
}

export default function BLETestScreen() {
  const [bleManager, setBleManager] = useState<BleManager | null>(null);
  const [devices, setDevices] = useState<KelaDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string>('');
  const [bluetoothState, setBluetoothState] = useState<string>('Unknown');
  const [isEmulator, setIsEmulator] = useState(false);

  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isScanningRef = useRef(false);
  const updatedAddressesRef = useRef<Set<string>>(new Set());

  const isFriendByUUID = useAppStore(state => state.isFriendByUUID);
  const isFriendByName = useAppStore(state => state.isFriendByName);
  const friends = useAppStore(state => state.friends);
  const updateFriendMac = useAppStore(state => state.updateFriendMac);
  const getCurrentMac = useAppStore(state => state.getCurrentMac);
  const myUUID = useAppStore(state => state.myUUID);

  useEffect(() => {
    const checkDevice = async () => {
      const isDevice = await ExpoDevice.isDevice;
      setIsEmulator(!isDevice);
      if (!isDevice) {
        setError('⚠️ BLE is not available on emulators. Please use a physical device.');
        return;
      }
      try {
        const manager = new BleManager();
        setBleManager(manager);
        const subscription = manager.onStateChange((state) => {
          setBluetoothState(state);
          if (state === 'PoweredOff') {
            Alert.alert('Bluetooth Off', 'Please turn on Bluetooth to scan for devices.');
          }
        }, true);
        return () => subscription.remove();
      } catch (err) {
        setError(`BLE initialization failed: ${err}`);
      }
    };
    checkDevice();
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        return Object.values(granted).every(s => s === PermissionsAndroid.RESULTS.GRANTED);
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    }
    return true;
  };

  const startScan = async () => {
    if (!bleManager || isScanningRef.current) return;

    const state = await bleManager.state();
    if (state !== 'PoweredOn') {
      Alert.alert('Bluetooth Required', 'Please turn on Bluetooth and try again.');
      return;
    }

    const hasPermissions = await requestPermissions();
    if (!hasPermissions) { setError('❌ Permissions denied'); return; }

    setDevices([]);
    setError('');
    setScanning(true);
    isScanningRef.current = true;
    updatedAddressesRef.current.clear();

    console.log('🔵 Starting filtered scan for Kela-Konnect devices...');

    try {
      bleManager.startDeviceScan([KELA_SERVICE_UUID], null, (err, device) => {
        if (err) {
          setError(`Scan error: ${err.message}`);
          stopScan();
          return;
        }

        if (device && device.name) {
          console.log(`📡 Found: ${device.name} (${device.id})`);

          // ── Read permanent UUID once per MAC per scan session ─────────────
          if (!updatedAddressesRef.current.has(device.id)) {
            updatedAddressesRef.current.add(device.id);
            (async () => {
              try {
                await BleClient.connectToDevice(device.id);
                const identityJson = await BleClient.readDeviceIdentity(device.id);
                const { uuid, name } = JSON.parse(identityJson);
                console.log(`🆔 UUID for ${name}: ${uuid}`);

                // Update device in list with their UUID
                setDevices(prev => prev.map(d =>
                  d.id === device.id ? { ...d, uuid } : d
                ));

                // ✅ Auto-update friend's MAC if we know them by UUID
                if (isFriendByUUID(uuid)) {
                  updateFriendMac(uuid, device.id);
                  console.log(`🔄 Auto-updated MAC for friend ${name}: ${device.id}`);
                }
              } catch (e) {
                // Identity read failed — device may be mid-rotation, skip silently
              }
            })();
          }

          // ── Friend detection (by UUID cached on device obj, name, or MAC) ─
          const isDeviceFriend =
            friends.some(f => f.currentMac === device.id) ||
            isFriendByName(device.name || '');

          // ── Deduplicate by name (handles MAC rotation in UI) ──────────────
          setDevices(prev => {
            const deviceName = device.name || 'Unknown';
            const byName = prev.findIndex(d => d.name === deviceName);
            const byMac  = prev.findIndex(d => d.id === device.id);

            const updated: KelaDevice = {
              id: device.id,
              name: deviceName,
              rssi: device.rssi || -100,
              lastSeen: new Date(),
              isFriend: isDeviceFriend,
            };

            if (byName >= 0) {
              // Same person, new MAC — update in place, keep uuid if already read
              const arr = [...prev];
              arr[byName] = { ...arr[byName], ...updated };
              return arr;
            } else if (byMac >= 0) {
              const arr = [...prev];
              arr[byMac] = { ...arr[byMac], ...updated };
              return arr;
            }
            return [...prev, updated];
          });
        }
      });

      scanTimeoutRef.current = setTimeout(() => {
        console.log('⏹️ Auto-stopping scan after 15s...');
        stopScan();
      }, 15000);

    } catch (err) {
      setError(`Start scan failed: ${err}`);
      setScanning(false);
      isScanningRef.current = false;
    }
  };

  const stopScan = () => {
    if (!isScanningRef.current) return;
    if (scanTimeoutRef.current) { clearTimeout(scanTimeoutRef.current); scanTimeoutRef.current = null; }
    try { bleManager?.stopDeviceScan(); } catch (e) {}
    setScanning(false);
    isScanningRef.current = false;
    console.log('⏹️ Scan stopped');
  };

  // ── Call: only available for friends ─────────────────────────────────────
  const handleCall = (device: KelaDevice) => {
    stopScan();

    // Prefer UUID-resolved friend data over raw scan data
    const friendUUID = device.uuid || '';
    const friend = friendUUID ? friends.find(f => f.uuid === friendUUID) : null;
    const latestMac = friend ? (getCurrentMac(friend.uuid) || device.id) : device.id;

    console.log(`📞 Calling ${device.name} | UUID: ${friendUUID} | MAC: ${latestMac}`);

    router.push({
      pathname: '/call',
      params: {
        friendId: latestMac,
        friendName: device.name,
        friendUUID: friendUUID,
      },
    });
  };

  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
      if (bleManager && isScanningRef.current) try { bleManager.stopDeviceScan(); } catch (e) {}
      bleManager?.destroy();
    };
  }, [bleManager]);

  if (isEmulator) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🔵 Scan for Users</Text>
        <View style={styles.emulatorWarning}>
          <Text style={styles.emulatorTitle}>⚠️ Emulator Detected</Text>
          <Text style={styles.emulatorText}>BLE not available on emulators. Use a physical device.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔵 Scan for Users</Text>

      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Bluetooth:</Text>
        <Text style={[styles.statusValue, { color: bluetoothState === 'PoweredOn' ? '#4CAF50' : '#F44336' }]}>
          {bluetoothState}
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.buttonContainer}>
        <Button
          title={scanning ? '⏳ Scanning...' : '▶️ Find Nearby Users'}
          onPress={startScan}
          disabled={scanning || bluetoothState !== 'PoweredOn'}
          color="#2196F3"
        />
        <Button title="⏹️ Stop" onPress={stopScan} disabled={!scanning} color="#F44336" />
      </View>

      <Text style={styles.subtitle}>
        👥 Nearby Users ({devices.length})
      </Text>

      <FlatList
        data={devices}
        keyExtractor={item => item.name} // ✅ key by name, not MAC
        renderItem={({ item }) => (
          <View style={[styles.deviceItem, { borderLeftColor: item.isFriend ? '#4CAF50' : '#2196F3' }]}>
            <View style={styles.deviceInfo}>
              <View style={styles.deviceHeader}>
                <Text style={styles.deviceName}>
                  {item.isFriend ? '👥 ' : '👤 '}{item.name}
                </Text>
                <Text style={styles.deviceRssi}>
                  {item.rssi > -60 ? '📶📶📶' : item.rssi > -80 ? '📶📶' : '📶'}
                </Text>
              </View>
              <Text style={styles.deviceId}>MAC: {item.id}</Text>
              <Text style={styles.deviceSignal}>
                {item.rssi} dBm • {getDistance(item.rssi)}
                {item.isFriend ? ' • FRIEND' : ' • Add via QR to call'}
              </Text>
            </View>

            <View style={styles.deviceActions}>
              {item.isFriend ? (
                // ✅ Only friends can be called from scan screen
                <TouchableOpacity style={styles.callButton} onPress={() => handleCall(item)}>
                  <Text style={styles.callButtonText}>📞</Text>
                </TouchableOpacity>
              ) : (
                // ✅ Non-friends: show QR hint, no Add button
                <TouchableOpacity style={styles.qrHintButton} onPress={() => router.push('/qr-code')}>
                  <Text style={styles.qrHintText}>📷{'\n'}QR</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyText}>
              {scanning
                ? 'Searching for Kela-Konnect users...'
                : 'No users found.\n\nMake sure other devices are broadcasting!'}
            </Text>
          </View>
        }
        style={styles.list}
      />

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          💡 Only friends can be called. Add friends via QR code.
        </Text>
      </View>
    </View>
  );
}

function getDistance(rssi: number): string {
  if (rssi > -50) return 'Very Close (<1m)';
  if (rssi > -70) return 'Close (1-5m)';
  if (rssi > -90) return 'Medium (5-15m)';
  return 'Far (15m+)';
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 20, marginTop: 40, textAlign: 'center', color: '#333' },
  emulatorWarning: { backgroundColor: '#FFF3E0', padding: 20, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#FF9800', marginTop: 20 },
  emulatorTitle: { fontSize: 20, fontWeight: 'bold', color: '#E65100', marginBottom: 12 },
  emulatorText: { fontSize: 16, color: '#666', lineHeight: 22 },
  statusContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20, padding: 10, backgroundColor: '#fff', borderRadius: 8 },
  statusLabel: { fontSize: 16, marginRight: 10, color: '#666' },
  statusValue: { fontSize: 16, fontWeight: 'bold' },
  buttonContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  subtitle: { fontSize: 18, fontWeight: '600', marginTop: 10, marginBottom: 10, color: '#333' },
  error: { color: '#F44336', marginBottom: 15, padding: 10, backgroundColor: '#FFEBEE', borderRadius: 8, fontSize: 14 },
  list: { flex: 1 },
  deviceItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, marginBottom: 10, backgroundColor: '#fff', borderRadius: 12, borderLeftWidth: 4, elevation: 2 },
  deviceInfo: { flex: 1 },
  deviceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  deviceName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  deviceRssi: { fontSize: 16 },
  deviceId: { fontSize: 11, color: '#999', marginBottom: 4, fontFamily: 'monospace' },
  deviceSignal: { fontSize: 12, color: '#666' },
  deviceActions: { marginLeft: 10 },
  callButton: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  callButtonText: { fontSize: 24 },
  qrHintButton: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#FF9800', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  qrHintText: { fontSize: 11, color: '#fff', fontWeight: 'bold', textAlign: 'center', lineHeight: 14 },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 64, marginBottom: 20 },
  emptyText: { textAlign: 'center', color: '#999', fontSize: 16, lineHeight: 24 },
  infoBox: { backgroundColor: '#E3F2FD', padding: 12, borderRadius: 8, marginTop: 10 },
  infoText: { fontSize: 14, color: '#666', textAlign: 'center' },
});