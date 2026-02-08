import { Link } from 'expo-router';
import { Button, StyleSheet, View } from 'react-native';

export default function Index() {
  return (
    <View style={styles.container}>
      <Link href="/ble-test" asChild>
        <Button title="🔍 BLE Scanner" />
      </Link>
      <Link href="/ble-advertise" asChild>
        <Button title="📢 BLE Advertiser" />
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
  },
});