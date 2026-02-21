import { Link } from 'expo-router';
import { useEffect } from 'react';
import { Button, ImageBackground, StyleSheet, View } from 'react-native';
import { useAppStore } from '../../store/appStore';

export default function HomeScreen() {
  const loadData = useAppStore(state => state.loadData);

  useEffect(() => {
    loadData();
  }, []);

  return (
    <ImageBackground
      source={require('../../assets/images/banana-bg.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <View style={styles.buttonGroup}>
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
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonGroup: {
    gap: 20,
    width: '70%',
  },
});