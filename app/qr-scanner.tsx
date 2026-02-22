import { Camera, CameraView } from 'expo-camera';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppStore } from '../store/appStore';

export default function QRScannerScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const addFriend = useAppStore(s => s.addFriend);
  const isFriendByUUID = useAppStore(s => s.isFriendByUUID);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    try {
      const parsed = JSON.parse(data);
      if (parsed.app !== 'kela-konnect' || !parsed.uuid || !parsed.name) {
        Alert.alert('Invalid QR', 'This is not a Kela-Konnect QR code.', [{ text: 'OK', onPress: () => setScanned(false) }]);
        return;
      }
      if (isFriendByUUID(parsed.uuid)) {
        Alert.alert('Already Friends', `${parsed.name} is already in your friends list.`, [{ text: 'OK', onPress: () => router.back() }]);
        return;
      }
      await addFriend({ uuid: parsed.uuid, name: parsed.name, currentMac: '', addedDate: new Date() });
      Alert.alert('🍌 Friend Added!', `${parsed.name} has been added.\n\nScan nearby to call them!`, [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert('Error', 'Could not read QR code.', [{ text: 'Try Again', onPress: () => setScanned(false) }]);
    }
  };

  if (hasPermission === null) return (
    <View style={styles.center}>
      <Text style={styles.statusText}>Requesting camera...</Text>
    </View>
  );

  if (hasPermission === false) return (
    <View style={styles.center}>
      <Text style={styles.icon}>📷</Text>
      <Text style={styles.errorTitle}>Camera access denied</Text>
      <Text style={styles.errorText}>Enable camera permissions in Settings to scan QR codes.</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Top overlay */}
      <View style={styles.topOverlay}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Scan QR Code</Text>
        <Text style={styles.topSub}>Point at a friend's Kela-Konnect code</Text>
      </View>

      {/* Middle row */}
      <View style={styles.middleRow}>
        <View style={styles.sideOverlay} />
        <View style={styles.scanFrame}>
          {/* Corners */}
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>
        <View style={styles.sideOverlay} />
      </View>

      {/* Bottom overlay */}
      <View style={styles.bottomOverlay}>
        {scanned ? (
          <TouchableOpacity style={styles.retryBtn} onPress={() => setScanned(false)}>
            <Text style={styles.retryBtnText}>Tap to Scan Again</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.bottomHint}>🍌  Align the QR code within the frame</Text>
        )}
      </View>
    </View>
  );
}

const FRAME = 260;
const CORNER = 32;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', padding: 40 },
  statusText: { color: 'rgba(255,255,255,0.5)', fontSize: 15 },
  icon: { fontSize: 56, marginBottom: 16 },
  errorTitle: { fontSize: 22, fontWeight: '900', color: '#fff', marginBottom: 10 },
  errorText: { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 22 },
  topOverlay: { backgroundColor: 'rgba(0,0,0,0.65)', paddingTop: 56, paddingBottom: 24, paddingHorizontal: 24, alignItems: 'center' },
  backBtn: { position: 'absolute', top: 56, right: 22, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 15, color: '#fff', fontWeight: '700' },
  topTitle: { fontSize: 22, fontWeight: '900', color: '#F5C842', letterSpacing: -0.5 },
  topSub: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 6, fontWeight: '600' },
  middleRow: { flexDirection: 'row', height: FRAME },
  sideOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  scanFrame: { width: FRAME, height: FRAME, position: 'relative' },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#F5C842', borderWidth: 3 },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  bottomOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 30 },
  bottomHint: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  retryBtn: { backgroundColor: '#F5C842', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 },
  retryBtnText: { fontSize: 15, fontWeight: '900', color: '#1a1a1a' },
});