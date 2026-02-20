import { Link } from 'expo-router';
import { useEffect } from 'react';
import {
  ImageBackground,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAppStore } from '../../store/appStore';

export default function Index() {
  const loadFriends = useAppStore(state => state.loadFriends);

  useEffect(() => {
    loadFriends();
  }, []);

  return (
    <>
      <StatusBar barStyle="light-content" />
      <ImageBackground
        source={require('../../assets/images/banana-bg.png')}
        style={styles.bg}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
          <View style={styles.container}>
            <Text style={styles.logo}>KELA</Text>

            <View style={styles.buttons}>
              <Link href="/ble-test" asChild>
                <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85}>
                  <Text style={styles.primaryText}>Scan for Users</Text>
                </TouchableOpacity>
              </Link>

              <Link href="/ble-advertise" asChild>
                <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.85}>
                  <Text style={styles.secondaryText}>Broadcast Presence</Text>
                </TouchableOpacity>
              </Link>

              <Link href="/friends" asChild>
                <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.85}>
                  <Text style={styles.secondaryText}>Friends</Text>
                </TouchableOpacity>
              </Link>

              <Link href="/qr-code" asChild>
                <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.85}>
                  <Text style={styles.secondaryText}>My QR Code</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </View>
      </ImageBackground>
    </>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  container: {
    width: '100%',
  },

  logo: {
    fontSize: 40,
    fontWeight: '800',
    color: 'white',
    letterSpacing: 3,
    marginBottom: 50,
  },

  buttons: {
    gap: 18,
  },

  primaryBtn: {
    backgroundColor: 'white',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },

  primaryText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },

  secondaryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },

  secondaryText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
});