import { router } from 'expo-router';
import React, { useEffect } from 'react';
import {
  Alert, FlatList, ImageBackground, StatusBar,
  StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useAppStore } from '../store/appStore';

const BG = require('../assets/images/banana-bg.png');

export default function FriendsScreen() {
  const friends = useAppStore(state => state.friends);
  const removeFriend = useAppStore(state => state.removeFriend);
  const loadData = useAppStore(state => state.loadData);
  const getCurrentMac = useAppStore(state => state.getCurrentMac);

  useEffect(() => { loadData(); }, []);

  const nearby = friends.filter(f => !!f.currentMac);
  const offline = friends.filter(f => !f.currentMac);

  const handleRemove = (uuid: string) => {
    const f = friends.find(f => f.uuid === uuid);
    if (!f) return;
    Alert.alert('Remove Friend', `Remove ${f.name} from your friends?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeFriend(uuid) },
    ]);
  };

  const handleCall = (item: any) => {
    const mac = getCurrentMac(item.uuid) || item.currentMac;
    if (!mac) {
      Alert.alert('Not Nearby', `Scan for nearby users to find ${item.name} first.`);
      return;
    }
    router.push({ pathname: '/call', params: { friendId: mac, friendName: item.name, friendUUID: item.uuid } });
  };

  const FriendRow = ({ item, isNearby }: any) => (
    <View style={[styles.card, !isNearby && styles.cardDim]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{item.name}</Text>
        <Text style={[styles.cardStatus, isNearby ? styles.statusOnline : styles.statusOffline]}>
          {isNearby ? '● Nearby' : '○ Not seen yet'}
        </Text>
      </View>
      <View style={styles.cardActions}>
        {isNearby && (
          <TouchableOpacity style={styles.callBtn} onPress={() => handleCall(item)}>
            <Text style={styles.callBtnIcon}>📞</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(item.uuid)}>
          <Text style={styles.removeBtnIcon}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ImageBackground source={BG} style={styles.bg} resizeMode="cover">
      <StatusBar barStyle="light-content" />
      <View style={styles.overlay}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>KELA-KONNECT</Text>
            <Text style={styles.headerTitle}>Friends</Text>
          </View>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/qr-code')}>
            <Text style={styles.headerBtnIcon}>📷</Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/ble-test')}>
            <Text style={styles.primaryBtnText}>📡  Scan Nearby</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/qr-scanner')}>
            <Text style={styles.secondaryBtnText}>+ Add Friend</Text>
          </TouchableOpacity>
        </View>

        {/* Friends count badge */}
        {friends.length > 0 && (
          <View style={styles.countRow}>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{friends.length} friends</Text>
            </View>
            {nearby.length > 0 && (
              <View style={[styles.countBadge, styles.countBadgeOnline]}>
                <Text style={[styles.countText, { color: '#4ADE80' }]}>● {nearby.length} nearby</Text>
              </View>
            )}
          </View>
        )}

        {/* List */}
        <FlatList
          data={[...nearby, ...offline]}
          keyExtractor={i => i.uuid}
          renderItem={({ item }) => (
            <FriendRow item={item} isNearby={!!getCurrentMac(item.uuid) || !!item.currentMac} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🍌</Text>
              <Text style={styles.emptyTitle}>No friends yet</Text>
              <Text style={styles.emptyText}>Tap + Add Friend to scan a QR code{'\n'}and add your first contact.</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          style={styles.list}
          showsVerticalScrollIndicator={false}
        />

        {/* Tip bar */}
        <View style={styles.tip}>
          <Text style={styles.tipText}>💡 Add friends via QR → Scan nearby → Call</Text>
        </View>

      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.38)' },

  header: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingTop: 60, paddingHorizontal: 22, paddingBottom: 18,
  },
  headerLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 3, color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  headerTitle: { fontSize: 34, fontWeight: '900', color: '#F5C842', letterSpacing: -1 },
  headerBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(245,200,66,0.15)',
    borderWidth: 1, borderColor: 'rgba(245,200,66,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerBtnIcon: { fontSize: 20 },

  actionRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 22, marginBottom: 16 },
  primaryBtn: {
    flex: 1, backgroundColor: '#F5C842', borderRadius: 14,
    paddingVertical: 13, alignItems: 'center',
    shadowColor: '#F5C842', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  primaryBtnText: { fontSize: 14, fontWeight: '800', color: '#1a1a1a' },
  secondaryBtn: {
    flex: 1, backgroundColor: 'rgba(20,20,20,0.78)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14, paddingVertical: 13, alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  countRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 22, marginBottom: 14 },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  countBadgeOnline: { backgroundColor: 'rgba(74,222,128,0.08)', borderColor: 'rgba(74,222,128,0.2)' },
  countText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 16 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(15,15,15,0.82)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 12,
  },
  cardDim: { opacity: 0.55 },

  avatar: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: '#F5C842',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarText: { fontSize: 22, fontWeight: '900', color: '#1a1a1a' },

  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '800', color: '#fff', marginBottom: 3 },
  cardStatus: { fontSize: 11, fontWeight: '700' },
  statusOnline: { color: '#4ADE80' },
  statusOffline: { color: 'rgba(255,255,255,0.3)' },

  cardActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  callBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: '#F5C842',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#F5C842', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  callBtnIcon: { fontSize: 17 },
  removeBtn: {
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  removeBtnIcon: { fontSize: 12, color: '#F87171', fontWeight: '800' },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '900', color: '#fff', marginBottom: 10 },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 22 },

  tip: {
    backgroundColor: 'rgba(245,200,66,0.08)',
    borderTopWidth: 1, borderTopColor: 'rgba(245,200,66,0.12)',
    padding: 14, alignItems: 'center',
  },
  tipText: { fontSize: 12, color: 'rgba(245,200,66,0.7)', fontWeight: '600' },
});