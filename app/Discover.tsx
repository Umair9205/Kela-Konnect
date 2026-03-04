import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert, FlatList, ImageBackground, PermissionsAndroid,
    Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import WifiDirect, { WifiDirectPeer } from '../modules/WifiDirect';
import { useAppStore } from '../store/appStore';

const BG = require('../assets/images/banana-bg.png');

interface DiscoveredPeer extends WifiDirectPeer {
  isFriend: boolean;
  friendUUID?: string;
}

export default function DiscoverScreen() {
  const [peers, setPeers] = useState<DiscoveredPeer[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState('');
  const [wifiEnabled, setWifiEnabled] = useState(true);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const friends = useAppStore(s => s.friends);
  const updateFriendMac = useAppStore(s => s.updateFriendMac);
  const getCurrentMac = useAppStore(s => s.getCurrentMac);

  useEffect(() => {
    const stateSub = WifiDirect.onStateChanged(({ enabled }) => {
      setWifiEnabled(enabled);
      if (!enabled) { setError('WiFi Direct is disabled'); stopDiscovery(); }
    });

    const peersSub = WifiDirect.onPeersFound(({ peers: found }) => {
      const enriched: DiscoveredPeer[] = found.map(p => {
        const matchedFriend = friends.find(f =>
          f.name === p.name || getCurrentMac(f.uuid) === p.address
        );
        if (matchedFriend) updateFriendMac(matchedFriend.uuid, p.address);
        return {
          ...p,
          isFriend: !!matchedFriend,
          friendUUID: matchedFriend?.uuid,
        };
      });
      setPeers(enriched);
    });

    return () => {
      stateSub.remove();
      peersSub.remove();
    };
  }, [friends]);

  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    const perms: string[] = [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    if (Platform.Version >= 33) {
      perms.push('android.permission.NEARBY_WIFI_DEVICES');
    }
    const results = await PermissionsAndroid.requestMultiple(perms as any);
    return Object.values(results).every(r => r === PermissionsAndroid.RESULTS.GRANTED);
  };

  const startDiscovery = async () => {
    if (discovering) return;
    setError('');
    if (!(await requestPermissions())) {
      setError('Location permission required for WiFi Direct'); return;
    }
    try {
      setPeers([]);
      setDiscovering(true);
      await WifiDirect.discoverPeers();
      // Auto-stop after 30s
      timeoutRef.current = setTimeout(stopDiscovery, 30_000);
    } catch (e: any) {
      setError(e?.message || 'Discovery failed');
      setDiscovering(false);
    }
  };

  const stopDiscovery = async () => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    try { await WifiDirect.stopDiscovery(); } catch (_) {}
    setDiscovering(false);
  };

  const handleCall = async (peer: DiscoveredPeer) => {
    if (!peer.isFriend) {
      Alert.alert('Not a Friend', 'Add this person via QR code first.');
      return;
    }
    await stopDiscovery();
    router.push({
      pathname: '/call',
      params: {
        peerAddress: peer.address,
        friendName: peer.name,
        friendUUID: peer.friendUUID ?? '',
        role: 'caller',
      },
    });
  };

  const statusColor = (status: number) => {
    switch (status) {
      case 0: return '#4ADE80';  // connected
      case 3: return '#F5C842';  // available
      default: return 'rgba(255,255,255,0.3)';
    }
  };

  const statusLabel = (status: number) => {
    switch (status) {
      case 0: return 'Connected';
      case 1: return 'Invited';
      case 2: return 'Failed';
      case 3: return 'Available';
      default: return 'Unavailable';
    }
  };

  return (
    <ImageBackground source={BG} style={styles.bg} resizeMode="cover">
      <StatusBar barStyle="light-content" />
      <View style={styles.overlay}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>KELA-KONNECT</Text>
            <Text style={styles.headerTitle}>Discover</Text>
          </View>
          <View style={[styles.badge, wifiEnabled ? styles.badgeOn : styles.badgeOff]}>
            <Text style={styles.badgeText}>
              {wifiEnabled ? '● WiFi Direct' : '○ WiFi Off'}
            </Text>
          </View>
        </View>

        {/* Scan button */}
        <View style={styles.scanRow}>
          <TouchableOpacity
            style={[styles.scanBtn, discovering && styles.scanBtnActive]}
            onPress={discovering ? stopDiscovery : startDiscovery}
            disabled={!wifiEnabled}
          >
            <Text style={styles.scanBtnText}>
              {discovering ? '⏹  Stop' : '📡  Find Nearby Users'}
            </Text>
          </TouchableOpacity>
        </View>

        {discovering && (
          <View style={styles.scanningRow}>
            <View style={styles.scanDot} />
            <Text style={styles.scanningText}>Scanning for nearby devices...</Text>
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {peers.length > 0 && (
          <Text style={styles.countLabel}>
            {peers.length} device{peers.length !== 1 ? 's' : ''} found
          </Text>
        )}

        <FlatList
          data={peers}
          keyExtractor={p => p.address}
          renderItem={({ item }) => (
            <View style={[styles.card, !item.isFriend && styles.cardDim]}>
              <View style={[styles.avatar, item.isFriend && styles.avatarFriend]}>
                <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{item.name}</Text>
                  {item.isFriend && (
                    <View style={styles.friendTag}>
                      <Text style={styles.friendTagText}>FRIEND</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.status, { color: statusColor(item.status) }]}>
                  ● {statusLabel(item.status)}
                </Text>
                <Text style={styles.mac}>{item.address}</Text>
              </View>
              {item.isFriend ? (
                <TouchableOpacity style={styles.callBtn} onPress={() => handleCall(item)}>
                  <Text style={styles.callBtnIcon}>📞</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.qrBtn} onPress={() => router.push('/qr-scanner')}>
                  <Text style={styles.qrBtnText}>+ QR</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>{discovering ? '📡' : '🔍'}</Text>
              <Text style={styles.emptyTitle}>{discovering ? 'Searching...' : 'No devices found'}</Text>
              <Text style={styles.emptyText}>
                {discovering
                  ? 'Looking for nearby Kela-Konnect users'
                  : 'Press scan. Both devices need WiFi enabled.'}
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          style={styles.list}
          showsVerticalScrollIndicator={false}
        />

        <View style={styles.tip}>
          <Text style={styles.tipText}>💡 Only friends can be called — add them via QR first</Text>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.38)' },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 22, paddingBottom: 18 },
  headerLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 3, color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  headerTitle: { fontSize: 34, fontWeight: '900', color: '#F5C842', letterSpacing: -1 },
  badge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  badgeOn: { backgroundColor: 'rgba(74,222,128,0.1)', borderColor: 'rgba(74,222,128,0.3)' },
  badgeOff: { backgroundColor: 'rgba(248,113,113,0.12)', borderColor: 'rgba(248,113,113,0.3)' },
  badgeText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  scanRow: { paddingHorizontal: 16, marginBottom: 14 },
  scanBtn: { backgroundColor: '#F5C842', borderRadius: 16, paddingVertical: 15, alignItems: 'center', shadowColor: '#F5C842', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  scanBtnActive: { backgroundColor: 'rgba(248,113,113,0.85)', shadowColor: '#F87171' },
  scanBtnText: { fontSize: 15, fontWeight: '900', color: '#1a1a1a' },
  scanningRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, marginBottom: 10 },
  scanDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' },
  scanningText: { fontSize: 12, color: '#4ADE80', fontWeight: '600' },
  errorText: { fontSize: 12, color: '#F87171', paddingHorizontal: 22, marginBottom: 8, fontWeight: '600' },
  countLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.4)', paddingHorizontal: 22, marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 16 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: 'rgba(15,15,15,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 20, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 12 },
  cardDim: { opacity: 0.6 },
  avatar: { width: 46, height: 46, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarFriend: { backgroundColor: '#F5C842' },
  avatarText: { fontSize: 20, fontWeight: '900', color: '#1a1a1a' },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  name: { fontSize: 15, fontWeight: '800', color: '#fff' },
  friendTag: { backgroundColor: 'rgba(245,200,66,0.15)', borderWidth: 1, borderColor: 'rgba(245,200,66,0.3)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  friendTagText: { fontSize: 9, fontWeight: '800', color: '#F5C842', letterSpacing: 1 },
  status: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  mac: { fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' },
  callBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#F5C842', alignItems: 'center', justifyContent: 'center', shadowColor: '#F5C842', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6, flexShrink: 0 },
  callBtnIcon: { fontSize: 18 },
  qrBtn: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, flexShrink: 0 },
  qrBtnText: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.6)' },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: '#fff', marginBottom: 8 },
  emptyText: { fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 20 },
  tip: { backgroundColor: 'rgba(245,200,66,0.08)', borderTopWidth: 1, borderTopColor: 'rgba(245,200,66,0.12)', padding: 14, alignItems: 'center' },
  tipText: { fontSize: 12, color: 'rgba(245,200,66,0.7)', fontWeight: '600' },
});