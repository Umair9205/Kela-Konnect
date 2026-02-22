import * as ExpoDevice from 'expo-device';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, FlatList, ImageBackground, PermissionsAndroid,
  Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { useAppStore } from '../store/appStore';

const BG = require('../assets/images/banana-bg.png');
const KELA_SERVICE_UUID = '0000FE00-0000-1000-8000-00805F9B34FB';

interface KelaDevice {
  id: string; name: string; rssi: number; isFriend: boolean; friendUUID?: string;
}

export default function BLETestScreen() {
  const [bleManager, setBleManager] = useState<BleManager | null>(null);
  const [devices, setDevices] = useState<KelaDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [btState, setBtState] = useState('Unknown');
  const [isEmulator, setIsEmulator] = useState(false);

  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isScanningRef = useRef(false);

  const friends = useAppStore(s => s.friends);
  const isFriendByName = useAppStore(s => s.isFriendByName);
  const updateFriendMac = useAppStore(s => s.updateFriendMac);
  const getCurrentMac = useAppStore(s => s.getCurrentMac);

  useEffect(() => {
    (async () => {
      const isDevice = await ExpoDevice.isDevice;
      setIsEmulator(!isDevice);
      if (!isDevice) return;
      const mgr = new BleManager();
      setBleManager(mgr);
      const sub = mgr.onStateChange(s => { setBtState(s); }, true);
      return () => sub.remove();
    })();
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS !== 'android') return true;
    if (Platform.Version >= 31) {
      const g = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return Object.values(g).every(s => s === PermissionsAndroid.RESULTS.GRANTED);
    }
    const g = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    return g === PermissionsAndroid.RESULTS.GRANTED;
  };

  const startScan = async () => {
    if (!bleManager || isScanningRef.current) return;
    if ((await bleManager.state()) !== 'PoweredOn') {
      Alert.alert('Bluetooth Required', 'Please turn on Bluetooth.'); return;
    }
    if (!(await requestPermissions())) { setError('Permissions denied'); return; }

    setDevices([]); setError(''); setScanning(true); isScanningRef.current = true;

    bleManager.startDeviceScan([KELA_SERVICE_UUID], null, (err, device) => {
      if (err) { setError(err.message); stopScan(); return; }
      if (!device?.name) return;
      const matchedFriend = friends.find(f => f.name === device.name);
      const isFriend = !!matchedFriend || isFriendByName(device.name);
      if (matchedFriend) updateFriendMac(matchedFriend.uuid, device.id);
      setDevices(prev => {
        const byName = prev.findIndex(d => d.name === device.name);
        const entry: KelaDevice = {
          id: device.id, name: device.name!, rssi: device.rssi || -100,
          isFriend, friendUUID: matchedFriend?.uuid,
        };
        if (byName >= 0) { const a = [...prev]; a[byName] = { ...a[byName], ...entry }; return a; }
        return [...prev, entry];
      });
    });
    scanTimeoutRef.current = setTimeout(stopScan, 15000);
  };

  const stopScan = () => {
    if (!isScanningRef.current) return;
    if (scanTimeoutRef.current) { clearTimeout(scanTimeoutRef.current); scanTimeoutRef.current = null; }
    try { bleManager?.stopDeviceScan(); } catch (e) {}
    setScanning(false); isScanningRef.current = false;
  };

  const handleCall = (device: KelaDevice) => {
    stopScan();
    const friendUUID = device.friendUUID || friends.find(f => f.name === device.name)?.uuid || '';
    if (!friendUUID) { Alert.alert('Not a Friend', 'Add this person via QR code first.'); return; }
    const mac = getCurrentMac(friendUUID) || device.id;
    router.push({ pathname: '/call', params: { friendId: mac, friendName: device.name, friendUUID } });
  };

  const rssiBar = (rssi: number) => rssi > -60 ? '▰▰▰▰' : rssi > -75 ? '▰▰▰▱' : rssi > -90 ? '▰▰▱▱' : '▰▱▱▱';

  if (isEmulator) return (
    <ImageBackground source={BG} style={styles.bg} resizeMode="cover">
      <View style={styles.overlay}>
        <View style={styles.errorCard}>
          <Text style={styles.errorCardIcon}>⚠️</Text>
          <Text style={styles.errorCardTitle}>Emulator Detected</Text>
          <Text style={styles.errorCardText}>BLE requires a physical device.</Text>
        </View>
      </View>
    </ImageBackground>
  );

  return (
    <ImageBackground source={BG} style={styles.bg} resizeMode="cover">
      <StatusBar barStyle="light-content" />
      <View style={styles.overlay}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>KELA-KONNECT</Text>
            <Text style={styles.headerTitle}>Scan</Text>
          </View>
          <View style={[styles.btBadge, btState === 'PoweredOn' && styles.btBadgeOn]}>
            <Text style={styles.btBadgeText}>
              {btState === 'PoweredOn' ? '● BT ON' : '○ BT OFF'}
            </Text>
          </View>
        </View>

        {/* Scan button */}
        <View style={styles.scanRow}>
          <TouchableOpacity
            style={[styles.scanBtn, scanning && styles.scanBtnActive]}
            onPress={scanning ? stopScan : startScan}
            disabled={btState !== 'PoweredOn'}
          >
            <Text style={styles.scanBtnText}>
              {scanning ? '⏹  Stop Scanning' : '📡  Find Nearby Users'}
            </Text>
          </TouchableOpacity>
        </View>

        {scanning && (
          <View style={styles.scanningIndicator}>
            <View style={styles.scanDot} />
            <Text style={styles.scanningText}>Scanning for Kela-Konnect devices...</Text>
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Count */}
        {devices.length > 0 && (
          <Text style={styles.countLabel}>{devices.length} device{devices.length !== 1 ? 's' : ''} found</Text>
        )}

        {/* Device list */}
        <FlatList
          data={devices}
          keyExtractor={i => i.name}
          renderItem={({ item }) => (
            <View style={[styles.card, !item.isFriend && styles.cardDim]}>
              <View style={[styles.devAvatar, item.isFriend && styles.devAvatarFriend]}>
                <Text style={styles.devAvatarText}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.devInfo}>
                <View style={styles.devNameRow}>
                  <Text style={styles.devName}>{item.name}</Text>
                  {item.isFriend && <View style={styles.friendTag}><Text style={styles.friendTagText}>FRIEND</Text></View>}
                </View>
                <Text style={styles.devRssi}>
                  <Text style={styles.rssiBar}>{rssiBar(item.rssi)}</Text>
                  {'  '}{item.rssi} dBm
                </Text>
              </View>
              {item.isFriend ? (
                <TouchableOpacity style={styles.callBtn} onPress={() => handleCall(item)}>
                  <Text style={styles.callBtnIcon}>📞</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.qrBtn} onPress={() => router.push('/qr-scanner')}>
                  <Text style={styles.qrBtnText}>+ QR</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>{scanning ? '📡' : '🔍'}</Text>
              <Text style={styles.emptyTitle}>{scanning ? 'Searching...' : 'No devices found'}</Text>
              <Text style={styles.emptyText}>
                {scanning ? 'Looking for nearby Kela-Konnect users' : 'Press scan and make sure other\ndevices are broadcasting'}
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          style={styles.list}
          showsVerticalScrollIndicator={false}
        />

        <View style={styles.tip}>
          <Text style={styles.tipText}>💡 Only friends can be called — add them via QR first</Text>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.38)' },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 22, paddingBottom: 18 },
  headerLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 3, color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  headerTitle: { fontSize: 34, fontWeight: '900', color: '#F5C842', letterSpacing: -1 },
  btBadge: { backgroundColor: 'rgba(248,113,113,0.12)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  btBadgeOn: { backgroundColor: 'rgba(74,222,128,0.1)', borderColor: 'rgba(74,222,128,0.3)' },
  btBadgeText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  scanRow: { paddingHorizontal: 16, marginBottom: 14 },
  scanBtn: { backgroundColor: '#F5C842', borderRadius: 16, paddingVertical: 15, alignItems: 'center', shadowColor: '#F5C842', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  scanBtnActive: { backgroundColor: 'rgba(248,113,113,0.85)', shadowColor: '#F87171' },
  scanBtnText: { fontSize: 15, fontWeight: '900', color: '#1a1a1a', letterSpacing: 0.3 },
  scanningIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, marginBottom: 10 },
  scanDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' },
  scanningText: { fontSize: 12, color: '#4ADE80', fontWeight: '600' },
  errorText: { fontSize: 12, color: '#F87171', paddingHorizontal: 22, marginBottom: 8, fontWeight: '600' },
  countLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.4)', paddingHorizontal: 22, marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 16 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: 'rgba(15,15,15,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 20, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 12 },
  cardDim: { opacity: 0.6 },
  devAvatar: { width: 46, height: 46, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  devAvatarFriend: { backgroundColor: '#F5C842' },
  devAvatarText: { fontSize: 20, fontWeight: '900', color: '#1a1a1a' },
  devInfo: { flex: 1 },
  devNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  devName: { fontSize: 15, fontWeight: '800', color: '#fff' },
  friendTag: { backgroundColor: 'rgba(245,200,66,0.15)', borderWidth: 1, borderColor: 'rgba(245,200,66,0.3)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  friendTagText: { fontSize: 9, fontWeight: '800', color: '#F5C842', letterSpacing: 1 },
  devRssi: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  rssiBar: { color: '#F5C842' },
  callBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#F5C842', alignItems: 'center', justifyContent: 'center', shadowColor: '#F5C842', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6, flexShrink: 0 },
  callBtnIcon: { fontSize: 18 },
  qrBtn: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, flexShrink: 0 },
  qrBtnText: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.6)' },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: '#fff', marginBottom: 8 },
  emptyText: { fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 20 },
  tip: { backgroundColor: 'rgba(245,200,66,0.08)', borderTopWidth: 1, borderTopColor: 'rgba(245,200,66,0.12)', padding: 14, alignItems: 'center' },
  tipText: { fontSize: 12, color: 'rgba(245,200,66,0.7)', fontWeight: '600' },
  errorCard: { margin: 40, backgroundColor: 'rgba(15,15,15,0.85)', borderRadius: 24, padding: 32, alignItems: 'center' },
  errorCardIcon: { fontSize: 48, marginBottom: 16 },
  errorCardTitle: { fontSize: 20, fontWeight: '900', color: '#fff', marginBottom: 8 },
  errorCardText: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
});