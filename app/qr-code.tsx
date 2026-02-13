import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useAppStore } from '../store/appStore';

export default function QRCodeScreen() {
  const { myDeviceId, myDeviceName } = useAppStore();
  const [qrData, setQrData] = useState<string>('');

  useEffect(() => {
    if (myDeviceId && myDeviceName) {
      // Create QR data with device info
      const data = JSON.stringify({
        id: myDeviceId,
        name: myDeviceName,
        app: 'kela-konnect'
      });
      setQrData(data);
    }
  }, [myDeviceId, myDeviceName]);

  const handleScanQR = () => {
    router.push('/qr-scanner');
  };

  if (!myDeviceId || !myDeviceName) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>📱 My QR Code</Text>
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            ⚠️ Please set up your device first!
          </Text>
          <Text style={styles.errorHint}>
            Go to Broadcast and enter your name to get started.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📱 My QR Code</Text>

      <View style={styles.qrContainer}>
        <Text style={styles.instruction}>
          Show this QR code to friends to add you
        </Text>

        <View style={styles.qrWrapper}>
          <QRCode
            value={qrData}
            size={250}
            backgroundColor="white"
            color="black"
          />
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Your Name:</Text>
          <Text style={styles.infoValue}>{myDeviceName}</Text>
          
          <Text style={styles.infoLabel}>Device ID:</Text>
          <Text style={styles.infoValueSmall}>{myDeviceId}</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.scanButton}
        onPress={handleScanQR}
      >
        <Text style={styles.scanButtonText}>📷 Scan Friend's QR Code</Text>
      </TouchableOpacity>

      <View style={styles.tipBox}>
        <Text style={styles.tipText}>
          💡 Tip: Ask your friend to open their QR code, then press "Scan Friend's QR Code"
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 40,
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  qrContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  instruction: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  qrWrapper: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  infoBox: {
    marginTop: 20,
    width: '100%',
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  infoValueSmall: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  scanButton: {
    backgroundColor: '#2196F3',
    padding: 18,
    borderRadius: 12,
    marginTop: 30,
    elevation: 2,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tipBox: {
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
  },
  tipText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: '#FFEBEE',
    padding: 20,
    borderRadius: 12,
    marginTop: 40,
  },
  errorText: {
    fontSize: 18,
    color: '#C62828',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  errorHint: {
    fontSize: 14,
    color: '#666',
  },
});