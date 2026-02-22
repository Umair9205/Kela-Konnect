import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ImageBackground, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useAppStore } from '../store/appStore';

const BG = require('../assets/images/banana-bg.png');

export default function QRCodeScreen() {
  const myUUID = useAppStore(s => s.myUUID);
  const myDeviceName = useAppStore(s => s.myDeviceName);
  const loadData = useAppStore(s => s.loadData);
  const [qrData, setQrData] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData().then(() => setLoading(false)); }, []);
  useEffect(() => {
    if (myUUID && myDeviceName) {
      setQrData(JSON.stringify({ uuid: myUUID, name: myDeviceName, app: 'kela-konnect' }));
    }
  }, [myUUID, myDeviceName]);

  return (
    <ImageBackground source={BG} style={styles.bg} resizeMode="cover">
      <StatusBar barStyle="light-content" />
      <View style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerLabel}>KELA-KONNECT</Text>
            <Text style={styles.headerTitle}>My QR Code</Text>
            <Text style={styles.headerSub}>Show this to friends to add you</Text>
          </View>

          {/* QR card */}
          <View style={styles.qrCard}>
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#F5C842" size="large" />
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            ) : !myUUID ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorTitle}>Setup required</Text>
                <Text style={styles.errorText}>Go to Broadcast to set your name first.</Text>
                <TouchableOpacity style={styles.setupBtn} onPress={() => router.push('/ble-advertise')}>
                  <Text style={styles.setupBtnText}>Go to Setup →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.qrWrapper}>
                  <QRCode value={qrData} size={220} backgroundColor="white" color="#1a1a1a" />
                </View>
                <View style={styles.qrInfo}>
                  <Text style={styles.qrInfoName}>{myDeviceName}</Text>
                  <Text style={styles.qrInfoId}>{myUUID?.substring(0, 18)}...</Text>
                </View>
              </>
            )}
          </View>

          {/* Scan friend button */}
          <TouchableOpacity style={styles.scanBtn} onPress={() => router.push('/qr-scanner')}>
            <Text style={styles.scanBtnText}>📷  Scan Friend's QR Code</Text>
          </TouchableOpacity>

          {/* Info */}
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              🍌  Share your QR code with friends.{'\n'}
              Once added, scan nearby to find and call them.
            </Text>
          </View>

        </ScrollView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  scroll: { flexGrow: 1, paddingTop: 60, paddingHorizontal: 22, paddingBottom: 40 },
  header: { marginBottom: 28, alignItems: 'center' },
  headerLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 3, color: 'rgba(255,255,255,0.5)', marginBottom: 6 },
  headerTitle: { fontSize: 34, fontWeight: '900', color: '#F5C842', letterSpacing: -1, marginBottom: 6 },
  headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.45)', fontWeight: '600' },
  qrCard: {
    backgroundColor: 'rgba(15,15,15,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 28, padding: 28, alignItems: 'center', marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 16,
  },
  loadingBox: { alignItems: 'center', gap: 16, paddingVertical: 40 },
  loadingText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' },
  errorBox: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  errorIcon: { fontSize: 48 },
  errorTitle: { fontSize: 20, fontWeight: '900', color: '#fff' },
  errorText: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
  setupBtn: { backgroundColor: '#F5C842', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24, marginTop: 8 },
  setupBtnText: { fontSize: 14, fontWeight: '800', color: '#1a1a1a' },
  qrWrapper: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 20 },
  qrInfo: { alignItems: 'center', gap: 6 },
  qrInfoName: { fontSize: 22, fontWeight: '900', color: '#F5C842' },
  qrInfoId: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' },
  scanBtn: {
    backgroundColor: '#F5C842', borderRadius: 16, paddingVertical: 15,
    alignItems: 'center', marginBottom: 16,
    shadowColor: '#F5C842', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  scanBtnText: { fontSize: 15, fontWeight: '900', color: '#1a1a1a' },
  infoCard: { backgroundColor: 'rgba(245,200,66,0.08)', borderWidth: 1, borderColor: 'rgba(245,200,66,0.15)', borderRadius: 16, padding: 16 },
  infoText: { fontSize: 13, color: 'rgba(245,200,66,0.7)', fontWeight: '600', lineHeight: 22, textAlign: 'center' },
});