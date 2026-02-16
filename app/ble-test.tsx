import * as ExpoDevice from 'expo-device';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Button, FlatList, PermissionsAndroid, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { useAppStore } from '../store/appStore';

const KELA_SERVICE_UUID = '0000FE00-0000-1000-8000-00805F9B34FB';

interface KelaDevice {
  id: string;              // BLE MAC address
  name: string;
  rssi: number;
  lastSeen: Date;
  isFriend: boolean;
}

export default function BLETestScreen() {
  const [bleManager, setBleManager] = useState<BleManager | null>(null);
  const [devices, setDevices] = useState<KelaDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string>('');
  const [bluetoothState, setBluetoothState] = useState<string>('Unknown');
  const [isEmulator, setIsEmulator] = useState(false);

  const isFriend = useAppStore(state => state.isFriend);
  const addFriend = useAppStore(state => state.addFriend);

  useEffect(() => {
    const checkDevice = async () => {
      const isDevice = await ExpoDevice.isDevice;
      setIsEmulator(!isDevice);
      
      if (!isDevice) {
        console.log('⚠️ Running on emulator - BLE not available');
        setError('⚠️ BLE is not available on emulators. Please use a physical device.');
        return;
      }

      try {
        const manager = new BleManager();
        setBleManager(manager);

        const subscription = manager.onStateChange((state) => {
          setBluetoothState(state);
          if (state === 'PoweredOff') {
            Alert.alert('Bluetooth Off', 'Please turn on Bluetooth to scan for devices.');
          }
        }, true);

        return () => subscription.remove();
      } catch (err) {
        console.error('❌ BLE initialization error:', err);
        setError(`BLE initialization failed: ${err}`);
      }
    };

    checkDevice();
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
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
            setError('❌ Permissions denied');
            return false;
          }
          return true;
        } catch (err) {
          setError(`Permission error: ${err}`);
          return false;
        }
      } else {
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
    return true;
  };

  const startScan = async () => {
    if (!bleManager) {
      Alert.alert('BLE Not Available', 'BLE is not available on this device.');
      return;
    }

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

    console.log('🔵 Starting filtered scan for Kela-Konnect devices...');
    console.log(`🔍 Looking for UUID: ${KELA_SERVICE_UUID}`);

    bleManager.startDeviceScan(
      [KELA_SERVICE_UUID],
      null,
      (error, device) => {
        if (error) {
          console.error('❌ Scan error:', error);
          setError(`Scan error: ${error.message}`);
          setScanning(false);
          return;
        }

        if (device) {
          console.log(`📡 Found Kela-Konnect device: ${device.name || 'Unnamed'} (${device.id})`);
          
          const isDeviceFriend = isFriend(device.id);
          
          if (isDeviceFriend) {
            console.log(`👥 Found FRIEND: ${device.name}`);
          }

          setDevices((prevDevices) => {
            const existingIndex = prevDevices.findIndex((d) => d.id === device.id);
            
            const newDevice: KelaDevice = {
              id: device.id,  // BLE MAC address
              name: device.name || 'Unknown User',
              rssi: device.rssi || -100,
              lastSeen: new Date(),
              isFriend: isDeviceFriend,
            };

            if (existingIndex >= 0) {
              const updated = [...prevDevices];
              updated[existingIndex] = newDevice;
              return updated;
            } else {
              return [...prevDevices, newDevice];
            }
          });
        }
      }
    );

    setTimeout(() => {
      console.log('⏹️ Stopping scan...');
      bleManager.stopDeviceScan();
      setScanning(false);
    }, 15000);
  };

  const stopScan = () => {
    if (bleManager) {
      bleManager.stopDeviceScan();
      setScanning(false);
      console.log('⏹️ Scan stopped manually');
    }
  };

  const handleAddFriend = async (device: KelaDevice) => {
    try {
      await addFriend({
        id: device.name,  // Custom display ID
        bleAddress: device.id,  // Real BLE MAC address
        name: device.name,
        addedDate: new Date(),
      });

      Alert.alert('✅ Friend Added!', `${device.name} has been added to your friends`);
      
      // Update local state
      setDevices(prevDevices => 
        prevDevices.map(d => 
          d.id === device.id ? { ...d, isFriend: true } : d
        )
      );
    } catch (error) {
      console.error('Error adding friend:', error);
      Alert.alert('Error', 'Failed to add friend');
    }
  };

  const handleCall = (device: KelaDevice) => {
    router.push({
      pathname: '/call',
      params: {
        friendId: device.id,  // Pass BLE MAC address
        friendName: device.name
      }
    });
  };

  useEffect(() => {
    return () => {
      if (bleManager) {
        bleManager.destroy();
      }
    };
  }, [bleManager]);

  if (isEmulator) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🔵 Kela-Konnect Scanner</Text>
        <View style={styles.emulatorWarning}>
          <Text style={styles.emulatorTitle}>⚠️ Emulator Detected</Text>
          <Text style={styles.emulatorText}>
            BLE is not available on emulators. Please use a physical device.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔵 Kela-Konnect Scanner</Text>
      
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
          title={scanning ? "⏳ Scanning..." : "▶️ Find Nearby Users"} 
          onPress={startScan}
          disabled={scanning || bluetoothState !== 'PoweredOn'}
          color="#2196F3"
        />
        <Button 
          title="⏹️ Stop" 
          onPress={stopScan}
          disabled={!scanning}
          color="#F44336"
        />
      </View>

      <Text style={styles.subtitle}>
        👥 Kela-Konnect Users Nearby ({devices.length}):
      </Text>

      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[
            styles.deviceItem,
            { borderLeftColor: item.isFriend ? '#4CAF50' : '#2196F3' }
          ]}>
            <View style={styles.deviceInfo}>
              <View style={styles.deviceHeader}>
                <Text style={styles.deviceName}>
                  {item.isFriend ? '👥 ' : '👤 '}{item.name}
                </Text>
                <Text style={styles.deviceRssi}>
                  {item.rssi > -60 ? '📶📶📶' : item.rssi > -80 ? '📶📶' : '📶'}
                </Text>
              </View>
              <Text style={styles.deviceId}>MAC: {item.id}</Text>
              <Text style={styles.deviceSignal}>
                Signal: {item.rssi} dBm • {getDistance(item.rssi)}
                {item.isFriend && ' • FRIEND'}
              </Text>
            </View>
            
            <View style={styles.deviceActions}>
              {!item.isFriend ? (
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => handleAddFriend(item)}
                >
                  <Text style={styles.addButtonText}>➕</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={() => handleCall(item)}
                >
                  <Text style={styles.callButtonText}>📞</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyText}>
              {scanning 
                ? 'Searching for Kela-Konnect users nearby...' 
                : 'No users found.\n\nMake sure other devices are broadcasting!'}
            </Text>
          </View>
        }
        style={styles.list}
      />

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          💡 Scan to find users • Add them as friends • Then call!
        </Text>
      </View>
    </View>
  );
}

function getDistance(rssi: number): string {
  if (rssi > -50) return 'Very Close (<1m)';
  if (rssi > -70) return 'Close (1-5m)';
  if (rssi > -90) return 'Medium (5-15m)';
  return 'Far (15m+)';
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
  emulatorWarning: {
    backgroundColor: '#FFF3E0',
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    marginTop: 20,
  },
  emulatorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E65100',
    marginBottom: 12,
  },
  emulatorText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  deviceName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  deviceRssi: {
    fontSize: 16,
  },
  deviceId: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  deviceSignal: {
    fontSize: 12,
    color: '#666',
  },
  deviceActions: {
    marginLeft: 10,
  },
  addButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  addButtonText: {
    fontSize: 24,
  },
  callButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  callButtonText: {
    fontSize: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    lineHeight: 24,
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});