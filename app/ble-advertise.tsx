import React, { useEffect, useState } from 'react';
import {
  Alert, ImageBackground, KeyboardAvoidingView,
  PermissionsAndroid,
  Platform,
  ScrollView, StatusBar, StyleSheet,
  Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import BlePeripheral from '../modules/BlePeripheral';
import { useAppStore } from '../store/appStore';

const BG = require('../assets/images/banana-bg.png');
const KELA_SERVICE_UUID = '0000FE00-0000-1000-8000-00805F9B34FB';

export default function BLEAdvertiseScreen() {
  const [bleManager] = useState(() => new BleManager());
  const [advertising, setAdvertisingLocal] = useState(false);
  const [btState, setBtState] = useState('Unknown');
  const [deviceName, setDeviceName] = useState('');
  const [error, setError] = useState('');

  const setAdvertising = useAppStore(s => s.setAdvertising);
  const initIdentity = useAppStore(s => s.initIdentity);
  const myStoredName = useAppStore(s => s.myDeviceName);
  const myUUID = useAppStore(s => s.myUUID);

  useEffect(() => {
    if (myStoredName) setDeviceName(myStoredName);
  }, [myStoredName]);

  useEffect(() => {
    const sub = bleManager.onStateChange(s => setBtState(s), true);
    const s1 = BlePeripheral.addListener('onAdvertisingStarted', () => { setAdvertisingLocal(true); setAdvertising(true); setError(''); });
    const s2 = BlePeripheral.addListener('onAdvertisingFailed', (e: any) => { setError(e.error); setAdvertisingLocal(false); setAdvertising(false); });
    const s3 = BlePeripheral.addListener('onAdvertisingStopped', () => { setAdvertisingLocal(false); setAdvertising(false); });
    return () => { sub.remove(); s1.remove(); s2.remove(); s3.remove(); };
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'android' && Platform.Version >= 31) {
      const g = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      if (!Object.values(g).every(s => s === PermissionsAndroid.RESULTS.GRANTED)) {
        setError('Permissions denied'); return false;
      }
    }
    return true;
  };

  const startBroadcasting = async () => {
    if (!deviceName.trim()) { Alert.alert('Name Required', 'Enter a name to broadcast.'); return; }
    if ((await bleManager.state()) !== 'PoweredOn') { Alert.alert('Bluetooth Required', 'Turn on Bluetooth first.'); return; }
    if (!(await requestPermissions())) return;
    try {
      setError('');
      await initIdentity(deviceName.trim());
      const uuid = useAppStore.getState().myUUID!;
      BlePeripheral.setDeviceUUID(uuid, deviceName.trim());
      await BlePeripheral.startAdvertising(deviceName.trim(), KELA_SERVICE_UUID);
      console.log(`📢 Broadcasting as: ${deviceName} | UUID: ${uuid}`);
    } catch (e: any) { setError(e.message || 'Failed to start'); }
  };

  const stopBroadcasting = async () => {
    try { await BlePeripheral.stopAdvertising(); } catch (e: any) { setError(e.message || 'Failed to stop'); }
  };

  const btOn = btState === 'PoweredOn';

  return (
    <ImageBackground source={BG} style={styles.bg} resizeMode="cover">
      <StatusBar barStyle="light-content" />
      <View style={styles.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerLabel}>KELA-KONNECT</Text>
              <Text style={styles.headerTitle}>Broadcast</Text>
              <Text style={styles.headerSub}>Make your device visible to nearby users</Text>
            </View>

            {/* Status card */}
            <View style={[styles.statusCard, advertising && styles.statusCardOn]}>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, advertising ? styles.dotOn : styles.dotOff]} />
                <Text style={styles.statusTitle}>
                  {advertising ? 'Broadcasting' : 'Not Broadcasting'}
                </Text>
              </View>
              {advertising && myUUID && (
                <Text style={styles.statusSub}>
                  Visible as: <Text style={styles.statusName}>{deviceName}</Text>
                </Text>
              )}
              <View style={styles.btRow}>
                <Text style={[styles.btText, btOn ? styles.btOn : styles.btOff]}>
                  Bluetooth: {btOn ? 'ON ✓' : 'OFF ✗'}
                </Text>
              </View>
            </View>

            {/* Name input */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Your Display Name</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Umair's Phone"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={deviceName}
                  onChangeText={setDeviceName}
                  editable={!advertising}
                  maxLength={32}
                  autoCapitalize="words"
                />
              </View>
              <Text style={styles.inputHint}>This name is visible to nearby Kela-Konnect users</Text>
            </View>

            {error ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>⚠️  {error}</Text>
              </View>
            ) : null}

            {/* UUID info */}
            {myUUID && (
              <View style={styles.idCard}>
                <Text style={styles.idLabel}>PERMANENT ID</Text>
                <Text style={styles.idValue}>{myUUID.substring(0, 24)}...</Text>
                <Text style={styles.idHint}>This never changes — it's your permanent identity</Text>
              </View>
            )}

            {/* Buttons */}
            <View style={styles.btnGroup}>
              <TouchableOpacity
                style={[styles.primaryBtn, (advertising || !btOn) && styles.btnDisabled]}
                onPress={startBroadcasting}
                disabled={advertising || !btOn}
              >
                <Text style={styles.primaryBtnText}>
                  {advertising ? '📢  Broadcasting...' : '▶  Start Broadcasting'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryBtn, !advertising && styles.btnDisabled]}
                onPress={stopBroadcasting}
                disabled={!advertising}
              >
                <Text style={styles.secondaryBtnText}>⏹  Stop Broadcasting</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.tip}>
              <Text style={styles.tipText}>
                🍌  Keep broadcasting on while friends scan for you
              </Text>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)' },
  scroll: { paddingTop: 60, paddingHorizontal: 22, paddingBottom: 40 },

  header: { marginBottom: 24 },
  headerLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 3, color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  headerTitle: { fontSize: 34, fontWeight: '900', color: '#F5C842', letterSpacing: -1, marginBottom: 6 },
  headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },

  statusCard: {
    backgroundColor: 'rgba(15,15,15,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20, padding: 18, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  statusCardOn: { borderColor: 'rgba(74,222,128,0.25)' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  dotOn: { backgroundColor: '#4ADE80' },
  dotOff: { backgroundColor: 'rgba(255,255,255,0.25)' },
  statusTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  statusSub: { fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: '600', marginBottom: 10 },
  statusName: { color: '#F5C842', fontWeight: '800' },
  btRow: { marginTop: 4 },
  btText: { fontSize: 12, fontWeight: '700' },
  btOn: { color: '#4ADE80' },
  btOff: { color: '#F87171' },

  inputSection: { marginBottom: 20 },
  inputLabel: { fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.6)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 },
  inputWrapper: {
    backgroundColor: 'rgba(15,15,15,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  input: { fontSize: 16, fontWeight: '700', color: '#fff' },
  inputHint: { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: '600', marginTop: 8 },

  errorCard: { backgroundColor: 'rgba(248,113,113,0.1)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.25)', borderRadius: 14, padding: 14, marginBottom: 16 },
  errorText: { fontSize: 13, color: '#F87171', fontWeight: '700' },

  idCard: {
    backgroundColor: 'rgba(245,200,66,0.06)', borderWidth: 1, borderColor: 'rgba(245,200,66,0.15)',
    borderRadius: 16, padding: 16, marginBottom: 20,
  },
  idLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 2, color: 'rgba(245,200,66,0.6)', marginBottom: 6, textTransform: 'uppercase' },
  idValue: { fontSize: 13, color: 'rgba(245,200,66,0.85)', fontFamily: 'monospace', fontWeight: '700', marginBottom: 4 },
  idHint: { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: '600' },

  btnGroup: { gap: 12, marginBottom: 20 },
  primaryBtn: {
    backgroundColor: '#F5C842', borderRadius: 16, paddingVertical: 16, alignItems: 'center',
    shadowColor: '#F5C842', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '900', color: '#1a1a1a' },
  secondaryBtn: {
    backgroundColor: 'rgba(248,113,113,0.12)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.25)',
    borderRadius: 16, paddingVertical: 16, alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '800', color: '#F87171' },
  btnDisabled: { opacity: 0.35 },

  tip: { backgroundColor: 'rgba(245,200,66,0.08)', borderWidth: 1, borderColor: 'rgba(245,200,66,0.12)', borderRadius: 14, padding: 14, alignItems: 'center' },
  tipText: { fontSize: 12, color: 'rgba(245,200,66,0.65)', fontWeight: '600', textAlign: 'center' },
});