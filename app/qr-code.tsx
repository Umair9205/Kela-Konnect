import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useAppStore } from '../store/appStore';

export default function QRCodeScreen() {
  const myUUID = useAppStore(state => state.myUUID);
  const myDeviceName = useAppStore(state => state.myDeviceName);
  const loadData = useAppStore(state => state.loadData);
  const [qrData, setQrData] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData().then(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (myUUID && myDeviceName) {
      setQrData(JSON.stringify({
        uuid: myUUID,      // ✅ permanent UUID — never a MAC
        name: myDeviceName,
        app: 'kela-konnect',
      }));
    }
  }, [myUUID, myDeviceName]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>📱 My QR Code</Text>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!myUUID || !myDeviceName) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>📱 My QR Code</Text>
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ Please set up your device first!</Text>
          <Text style={styles.errorHint}>
            Go to "Broadcast Presence" and enter your name to get started.
          </Text>
          <TouchableOpacity style={styles.setupButton} onPress={() => router.push('/ble-advertise')}>
            <Text style={styles.setupButtonText}>Go to Setup</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📱 My QR Code</Text>

      <View style={styles.qrContainer}>
        <Text style={styles.instruction}>Show this to friends so they can add you</Text>

        <View style={styles.qrWrapper}>
          <QRCode value={qrData} size={250} backgroundColor="white" color="black" />
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Your Name</Text>
          <Text style={styles.infoValue}>{myDeviceName}</Text>
          <Text style={styles.infoLabel}>Permanent ID</Text>
          <Text style={styles.infoValueSmall}>{myUUID}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.scanButton} onPress={() => router.push('/qr-scanner')}>
        <Text style={styles.scanButtonText}>📷 Scan Friend's QR Code</Text>
      </TouchableOpacity>

      <View style={styles.tipBox}>
        <Text style={styles.tipText}>
          💡 Friends are added via QR only. Once added, scan nearby to call them.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 30, textAlign: 'center', color: '#333' },
  loadingText: { marginTop: 20, fontSize: 16, color: '#666', textAlign: 'center' },
  qrContainer: { backgroundColor: '#fff', borderRadius: 20, padding: 30, alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, marginBottom: 20 },
  instruction: { fontSize: 16, color: '#666', marginBottom: 20, textAlign: 'center' },
  qrWrapper: { padding: 20, backgroundColor: '#fff', borderRadius: 12, borderWidth: 2, borderColor: '#e0e0e0' },
  infoBox: { marginTop: 20, width: '100%', backgroundColor: '#f9f9f9', padding: 15, borderRadius: 8 },
  infoLabel: { fontSize: 12, color: '#999', marginTop: 8 },
  infoValue: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  infoValueSmall: { fontSize: 11, color: '#666', fontFamily: 'monospace' },
  scanButton: { backgroundColor: '#2196F3', padding: 18, borderRadius: 12, elevation: 2 },
  scanButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  tipBox: { backgroundColor: '#E3F2FD', padding: 15, borderRadius: 8, marginTop: 20 },
  tipText: { fontSize: 14, color: '#666', lineHeight: 20 },
  errorBox: { backgroundColor: '#FFEBEE', padding: 30, borderRadius: 12, alignItems: 'center' },
  errorText: { fontSize: 18, color: '#C62828', fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  errorHint: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20 },
  setupButton: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 8, marginTop: 10 },
  setupButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});