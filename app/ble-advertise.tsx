import React, { useEffect, useState } from 'react';
import { Alert, Button, PermissionsAndroid, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { BleManager } from 'react-native-ble-plx';

// Unique Service UUID for Kela-Konnect
const KELA_SERVICE_UUID = '0000FE00-0000-1000-8000-00805F9B34FB';

export default function BLEAdvertiseScreen() {
  const [bleManager] = useState(() => new BleManager());
  const [advertising, setAdvertising] = useState(false);
  const [bluetoothState, setBluetoothState] = useState<string>('Unknown');
  const [deviceName, setDeviceName] = useState('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const subscription = bleManager.onStateChange((state) => {
      setBluetoothState(state);
    }, true);

    return () => subscription.remove();
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        try {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);

          const allGranted = Object.values(granted).every(
            (status) => status === PermissionsAndroid.RESULTS.GRANTED
          );

          if (!allGranted) {
            setError('❌ Advertising permissions denied');
            return false;
          }
          return true;
        } catch (err) {
          setError(`Permission error: ${err}`);
          return false;
        }
      }
    }
    return true;
  };

  const startAdvertising = async () => {
    if (!deviceName.trim()) {
      Alert.alert('Name Required', 'Please enter a device name to advertise');
      return;
    }

    const state = await bleManager.state();
    if (state !== 'PoweredOn') {
      Alert.alert('Bluetooth Required', 'Please turn on Bluetooth and try again.');
      return;
    }

    const hasPermissions = await requestPermissions();
    if (!hasPermissions) return;

    setError('');
    setAdvertising(true);

    console.log(`📢 Starting to advertise as: ${deviceName}`);
    Alert.alert(
      'Advertising Started',
      `Your device is now broadcasting as "${deviceName}". Other Kela-Konnect devices nearby should be able to see you!`,
      [{ text: 'OK' }]
    );

    // Note: react-native-ble-plx doesn't support peripheral mode directly
    // We'll need to implement this with native modules in the future
    // For now, this is a placeholder UI
  };

  const stopAdvertising = () => {
    console.log('📢 Stopping advertising...');
    setAdvertising(false);
    Alert.alert('Advertising Stopped', 'Your device is no longer visible to other devices.');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📢 BLE Advertiser</Text>

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

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Your Device Name:</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Umair's Phone"
          value={deviceName}
          onChangeText={setDeviceName}
          editable={!advertising}
        />
        <Text style={styles.hint}>
          This name will be visible to other Kela-Konnect users nearby
        </Text>
      </View>

      <View style={styles.statusBox}>
        <Text style={styles.statusBoxTitle}>
          {advertising ? '✅ Broadcasting' : '⏸️ Not Broadcasting'}
        </Text>
        {advertising && (
          <Text style={styles.statusBoxText}>
            Other devices can now discover you as: {deviceName}
          </Text>
        )}
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title={advertising ? "📢 Broadcasting..." : "▶️ Start Broadcasting"}
          onPress={startAdvertising}
          disabled={advertising || bluetoothState !== 'PoweredOn'}
          color="#4CAF50"
        />
        <Button
          title="⏹️ Stop Broadcasting"
          onPress={stopAdvertising}
          disabled={!advertising}
          color="#F44336"
        />
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>ℹ️ Note:</Text>
        <Text style={styles.infoText}>
          BLE advertising (peripheral mode) requires native module implementation.
          This screen demonstrates the UI - full functionality will be added in the next step.
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
  error: {
    color: '#F44336',
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    fontSize: 14,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  statusBox: {
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  statusBoxTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  statusBoxText: {
    fontSize: 14,
    color: '#666',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  infoBox: {
    backgroundColor: '#FFF3E0',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});