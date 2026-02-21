import { Camera, CameraView } from 'expo-camera';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppStore } from '../store/appStore';

export default function QRScannerScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  const addFriend = useAppStore(state => state.addFriend);
  const isFriendByUUID = useAppStore(state => state.isFriendByUUID);

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

      // Validate it's a Kela-Konnect QR
      if (parsed.app !== 'kela-konnect' || !parsed.uuid || !parsed.name) {
        Alert.alert('Invalid QR Code', 'This is not a Kela-Konnect QR code.', [
          { text: 'OK', onPress: () => setScanned(false) }
        ]);
        return;
      }

      // Check already friends
      if (isFriendByUUID(parsed.uuid)) {
        Alert.alert('Already Friends', `${parsed.name} is already in your friends list.`, [
          { text: 'OK', onPress: () => router.back() }
        ]);
        return;
      }

      // ✅ Add friend by UUID — no MAC needed yet
      // currentMac will be populated automatically when they are seen during a scan
      await addFriend({
        uuid: parsed.uuid,
        name: parsed.name,
        currentMac: '',       // empty — will be filled in by scan
        addedDate: new Date(),
      });

      Alert.alert(
        '✅ Friend Added!',
        `${parsed.name} has been added.\n\nScan for nearby users to find and call them.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );

    } catch (error) {
      console.error('QR scan error:', error);
      Alert.alert('Error', 'Could not read QR code. Try again.', [
        { text: 'OK', onPress: () => setScanned(false) }
      ]);
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.statusText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No access to camera</Text>
        <Text style={styles.hintText}>Please enable camera permissions in Settings</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        <View style={styles.overlay}>
          <View style={styles.topOverlay} />
          <View style={styles.middleRow}>
            <View style={styles.sideOverlay} />
            <View style={styles.scanArea}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <View style={styles.sideOverlay} />
          </View>
          <View style={styles.bottomOverlay}>
            <Text style={styles.instruction}>📷 Point camera at friend's QR code</Text>
            {scanned && (
              <TouchableOpacity style={styles.scanAgainButton} onPress={() => setScanned(false)}>
                <Text style={styles.scanAgainText}>Tap to Scan Again</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  camera: { flex: 1, width: '100%' },
  statusText: { color: '#fff', fontSize: 16 },
  errorText: { color: '#fff', fontSize: 18, marginBottom: 10 },
  hintText: { color: '#999', fontSize: 14 },
  overlay: { flex: 1 },
  topOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  middleRow: { flexDirection: 'row', height: 300 },
  sideOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  scanArea: { width: 300, height: 300, position: 'relative' },
  corner: { position: 'absolute', width: 40, height: 40, borderColor: '#4CAF50', borderWidth: 4 },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  bottomOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  instruction: { color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  scanAgainButton: { marginTop: 20, padding: 15, backgroundColor: '#4CAF50', borderRadius: 8 },
  scanAgainText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});