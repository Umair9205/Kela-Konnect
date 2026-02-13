import { Link } from 'expo-router';
import { useEffect } from 'react';
import { Button, StyleSheet, View } from 'react-native';
import { useAppStore } from '../../store/appStore';

export default function Index() {
  const loadFriends = useAppStore(state => state.loadFriends);

  useEffect(() => {
    // Load all data on app start
    loadFriends();
  }, []);

  return (
    <View style={styles.container}>
      <Link href="/ble-test" asChild>
        <Button title="🔍 Scan for Users" color="#2196F3" />
      </Link>
      <Link href="/ble-advertise" asChild>
        <Button title="📢 Broadcast Presence" color="#4CAF50" />
      </Link>
      <Link href="/friends" asChild>
        <Button title="👥 Friends" color="#9C27B0" />
      </Link>
      <Link href="/qr-code" asChild>
        <Button title="📱 My QR Code" color="#FF9800" />
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    backgroundColor: '#f5f5f5',
  },
});