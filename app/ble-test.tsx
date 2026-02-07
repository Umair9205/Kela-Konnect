import React, { useEffect, useState } from 'react';
import { Alert, Button, FlatList, PermissionsAndroid, Platform, StyleSheet, Text, View } from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';

export default function BLETestScreen() {
  const [bleManager] = useState(() => new BleManager());
  const [devices, setDevices] = useState<Device[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string>('');
  const [bluetoothState, setBluetoothState] = useState<string>('Unknown');

  // Check Bluetooth state
  useEffect(() => {
    const subscription = bleManager.onStateChange((state) => {
      setBluetoothState(state);
      if (state === 'PoweredOff') {
        Alert.alert('Bluetooth Off', 'Please turn on Bluetooth to scan for devices.');
      }
    }, true);

    return () => subscription.remove();
  }, []);

  // Request Bluetooth permissions on Android
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        // Android 12+
        try {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);

          const allGranted = Object.values(granted).every(
            (status) => status === PermissionsAndroid.RESULTS.GRANTED
          );

          if (!allGranted) {
            setError('❌ Permissions denied. Go to Settings > Apps > Kela-Konnect > Permissions and enable Bluetooth & Location.');
            return false;
          }
          return true;
        } catch (err) {
          setError(`Permission error: ${err}`);
          return false;
        }
      } else {
        // Android 11 and below
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );

          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            setError('❌ Location permission denied');
            return false;
          }
          return true;
        } catch (err) {
          setError(`Permission error: ${err}`);
          return false;
        }
      }
    }
    return true; // iOS handles permissions differently
  };

  // Start scanning for BLE devices
  const startScan = async () => {
    // Check Bluetooth state first
    const state = await bleManager.state();
    if (state !== 'PoweredOn') {
      Alert.alert('Bluetooth Required', 'Please turn on Bluetooth and try again.');
      return;
    }

    const hasPermissions = await requestPermissions();
    if (!hasPermissions) return;

    setDevices([]);
    setError('');
    setScanning(true);

    console.log('🔵 Starting BLE scan...');

    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error('❌ Scan error:', error);
        setError(`Scan error: ${error.message}`);
        setScanning(false);
        return;
      }

      if (device) {
        console.log(`📡 Found device: ${device.name || 'Unnamed'} (${device.id})`);
        
        setDevices((prevDevices) => {
          // Avoid duplicates
          const exists = prevDevices.find((d) => d.id === device.id);
          if (exists) return prevDevices;
          return [...prevDevices, device];
        });
      }
    });

    // Stop scanning after 10 seconds
    setTimeout(() => {
      console.log('⏹️ Stopping scan...');
      bleManager.stopDeviceScan();
      setScanning(false);
    }, 10000);
  };

  // Stop scanning
  const stopScan = () => {
    bleManager.stopDeviceScan();
    setScanning(false);
    console.log('⏹️ Scan stopped manually');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      bleManager.destroy();
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔵 BLE Scanner Test</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Bluetooth Status:</Text>
        <Text style={[
          styles.statusValue,
          { color: bluetoothState === 'PoweredOn' ? '#4CAF50' : '#F44336' }
        ]}>
          {bluetoothState}
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.buttonContainer}>
        <Button 
          title={scanning ? "⏳ Scanning..." : "▶️ Start Scan"} 
          onPress={startScan}
          disabled={scanning || bluetoothState !== 'PoweredOn'}
          color="#2196F3"
        />
        <Button 
          title="⏹️ Stop Scan" 
          onPress={stopScan}
          disabled={!scanning}
          color="#F44336"
        />
      </View>

      <Text style={styles.subtitle}>
        📱 Found Devices ({devices.length}):
      </Text>

      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.deviceItem}>
            <Text style={styles.deviceName}>
              {item.name || '❓ Unnamed Device'}
            </Text>
            <Text style={styles.deviceId}>ID: {item.id.substring(0, 20)}...</Text>
            <Text style={styles.deviceRssi}>
              📶 Signal: {item.rssi} dBm
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {scanning ? '🔍 Scanning for devices...' : '📭 No devices found. Press "Start Scan"'}
          </Text>
        }
        style={styles.list}
      />
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
    marginBottom: 20,
    marginTop: 40,
    textAlign: 'center',
    color: '#333',
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  statusLabel: {
    fontSize: 16,
    marginRight: 10,
    color: '#666',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
    color: '#333',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  error: {
    color: '#F44336',
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    fontSize: 14,
  },
  list: {
    flex: 1,
  },
  deviceItem: {
    padding: 15,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  deviceId: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  deviceRssi: {
    fontSize: 12,
    color: '#999',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
    fontSize: 16,
  },
});