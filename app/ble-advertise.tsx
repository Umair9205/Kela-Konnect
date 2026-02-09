import React, { useEffect, useState } from 'react';
import { Alert, Button, PermissionsAndroid, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import BlePeripheral from '../modules/BlePeripheral';

// Kela-Konnect Service UUID (standardized format)
const KELA_SERVICE_UUID = '0000FE00-0000-1000-8000-00805F9B34FB';

export default function BLEAdvertiseScreen() {
  const [bleManager] = useState(() => new BleManager());
  const [advertising, setAdvertising] = useState(false);
  const [bluetoothState, setBluetoothState] = useState<string>('Unknown');
  const [deviceName, setDeviceName] = useState('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Monitor Bluetooth state
    const subscription = bleManager.onStateChange((state) => {
      setBluetoothState(state);
    }, true);

    // Listen for advertising events
    const startedListener = BlePeripheral.addListener('onAdvertisingStarted', (event) => {
      console.log('✅ Advertising started:', event);
      setAdvertising(true);
      setError('');
    });

    const failedListener = BlePeripheral.addListener('onAdvertisingFailed', (event) => {
      console.error('❌ Advertising failed:', event);
      setError(`Failed: ${event.error}`);
      setAdvertising(false);
    });

    const stoppedListener = BlePeripheral.addListener('onAdvertisingStopped', (event) => {
      console.log('⏹️ Advertising stopped:', event);
      setAdvertising(false);
    });

    return () => {
      subscription.remove();
      startedListener.remove();
      failedListener.remove();
      stoppedListener.remove();
    };
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

    try {
      setError('');
      console.log(`📢 Starting to advertise as: ${deviceName}`);

      await BlePeripheral.startAdvertising(deviceName, KELA_SERVICE_UUID);

      Alert.alert(
        '✅ Broadcasting Started!',
        `Your device "${deviceName}" is now visible to other Kela-Konnect devices!`,
        [{ text: 'OK' }]
      );

    } catch (error: any) {
      console.error('❌ Start advertising error:', error);
      setError(error.message || 'Failed to start advertising');
    }
  };

  const stopAdvertising = async () => {
    try {
      await BlePeripheral.stopAdvertising();
      Alert.alert('Broadcasting Stopped', 'Your device is no longer visible.');
    } catch (error: any) {
      console.error('Stop error:', error);
      setError(error.message || 'Failed to stop advertising');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📢 BLE Advertiser (Native)</Text>

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

      <View style={[
        styles.statusBox,
        { backgroundColor: advertising ? '#E8F5E9' : '#FFF3E0', borderLeftColor: advertising ? '#4CAF50' : '#FF9800' }
      ]}>
        <Text style={styles.statusBoxTitle}>
          {advertising ? '✅ Broadcasting (Native Module)' : '⏸️ Not Broadcasting'}
        </Text>
        {advertising && (
          <Text style={styles.statusBoxText}>
            Broadcasting as: <Text style={styles.bold}>{deviceName}</Text>
            {'\n'}Service UUID: {KELA_SERVICE_UUID}
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
        <Text style={styles.infoTitle}>✨ Native Implementation</Text>
        <Text style={styles.infoText}>
          Using custom Android native module for full BLE peripheral control.
          {'\n\n'}• High-power advertising
          {'\n'}• Custom service UUID
          {'\n'}• Event-driven updates
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
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
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
    lineHeight: 20,
  },
  bold: {
    fontWeight: 'bold',
    color: '#333',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  infoBox: {
    backgroundColor: '#E8EAF6',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3F51B5',
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
    lineHeight: 22,
  },
});