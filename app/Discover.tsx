/**
 * discover.tsx — WiFi Direct peer discovery (FR-2, FR-3, FR-4, FR-6, FR-7)
 */
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, ImageBackground, PermissionsAndroid, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import WifiDirect, { WifiDirectPeer } from '../modules/WifiDirect';
import { useAppStore } from '../store/appStore';

const BG = require('../assets/images/banana-bg.png');

interface EnrichedPeer extends WifiDirectPeer { isFriend: boolean; friendUUID?: string; }

export default function DiscoverScreen() {
  const [peers, setPeers]           = useState<EnrichedPeer[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [wifiEnabled, setWifiEnabled] = useState(true);
  const [error, setError]           = useState('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  const friends          = useAppStore(s => s.friends);
  const updateFriendMac  = useAppStore(s => s.updateFriendMac);
  const settings         = useAppStore(s => s.settings);

  useEffect(() => {
    const stateSub = WifiDirect.onStateChanged(({ enabled }) => {
      setWifiEnabled(enabled);
      if (!enabled) { setError('WiFi Direct disabled'); stopDiscovery(); }
    });
    const peersSub = WifiDirect.onPeersFound(({ peers: found }) => {
      const enriched = found.map(p => {
        const match = friends.find(f => f.name === p.name || f.currentMac === p.address);
        if (match) updateFriendMac(match.uuid, p.address);
        return { ...p, isFriend: !!match, friendUUID: match?.uuid };
      });
      // Deduplicate by address
      const seen = new Set<string>();
      const deduped = enriched.filter(p => { if (seen.has(p.address)) return false; seen.add(p.address); return true; });
      setPeers(deduped);
    });
    return () => { stateSub.remove(); peersSub.remove(); };
  }, [friends]);

  const requestPermissions = async () => {
    if (Platform.OS !== 'android') return true;
    const perms: any[] = [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    if (Platform.Version >= 33) perms.push('android.permission.NEARBY_WIFI_DEVICES');
    const results = await PermissionsAndroid.requestMultiple(perms);
    return Object.values(results).every(r => r === PermissionsAndroid.RESULTS.GRANTED);
  };

  const startDiscovery = async () => {
    if (discovering) return;
    if (!settings.scanningEnabled) { setError('Scanning disabled in Settings'); return; }
    setError('');
    if (!(await requestPermissions())) { setError('Location permission needed for WiFi Direct'); return; }
    try {
      setPeers([]);
      setDiscovering(true);
      await WifiDirect.discoverPeers();
      timeoutRef.current = setTimeout(stopDiscovery, 30_000);
    } catch (e: any) {
      setError(e?.message ?? 'Discovery failed');
      setDiscovering(false);
    }
  };

  const stopDiscovery = async () => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    try { await WifiDirect.stopDiscovery(); } catch (_) {}
    setDiscovering(false);
  };

  const callPeer = async (peer: EnrichedPeer) => {
    if (!peer.isFriend) { Alert.alert('Not a Friend', 'Add this contact via QR code first.'); return; }
    await stopDiscovery();
    router.push({ pathname: '/call', params: { friendName: peer.name, friendUUID: peer.friendUUID ?? '' } });
  };

  const statusColor = (st: number) => st === 0 ? '#4ADE80' : st === 3 ? '#F5C842' : 'rgba(255,255,255,0.3)';
  const statusLabel = (st: number) => ({ 0:'Connected', 1:'Invited', 2:'Failed', 3:'Available' }[st] ?? 'Unavailable');

  return (
    <ImageBackground source={BG} style={s.bg} resizeMode="cover">
      <StatusBar barStyle="light-content" />
      <View style={s.overlay}>
        <View style={s.header}>
          <View><Text style={s.eyebrow}>KELA-KONNECT</Text><Text style={s.title}>Discover</Text></View>
          <View style={[s.badge, wifiEnabled ? s.badgeOn : s.badgeOff]}>
            <Text style={s.badgeTxt}>{wifiEnabled ? '● WiFi Direct' : '○ WiFi Off'}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[s.scanBtn, discovering && s.scanBtnStop]}
          onPress={discovering ? stopDiscovery : startDiscovery}
          disabled={!wifiEnabled}
          accessibilityLabel={discovering ? 'Stop scanning' : 'Scan for peers'}
          accessibilityRole="button"
        >
          <Text style={s.scanBtnTxt}>{discovering ? '⏹  Stop Scanning' : '📡  Find Nearby Users'}</Text>
        </TouchableOpacity>

        {discovering && <Text style={s.scanningTxt}>● Scanning for nearby devices...</Text>}
        {!!error    && <Text style={s.errorTxt}>{error}</Text>}
        {peers.length > 0 && <Text style={s.countTxt}>{peers.length} device{peers.length !== 1 ? 's' : ''} found</Text>}

        <FlatList
          data={peers}
          keyExtractor={p => p.address}
          renderItem={({ item }) => (
            <View style={[s.card, !item.isFriend && s.cardDim]}>
              <View style={[s.avatar, item.isFriend && s.avatarFriend]}>
                <Text style={s.avatarTxt}>{item.name[0]?.toUpperCase()}</Text>
              </View>
              <View style={s.info}>
                <View style={s.nameRow}>
                  <Text style={s.peerName}>{item.name}</Text>
                  {item.isFriend && <View style={s.friendTag}><Text style={s.friendTagTxt}>FRIEND</Text></View>}
                </View>
                <Text style={[s.statusTxt, { color: statusColor(item.status) }]}>● {statusLabel(item.status)}</Text>
                <Text style={s.mac}>{item.address}</Text>
              </View>
              {item.isFriend
                ? <TouchableOpacity style={s.callBtn} onPress={() => callPeer(item)} accessibilityLabel="Call" accessibilityRole="button"><Text style={s.callBtnTxt}>📞</Text></TouchableOpacity>
                : <TouchableOpacity style={s.qrBtn} onPress={() => router.push('/qr-scanner')}><Text style={s.qrBtnTxt}>+ QR</Text></TouchableOpacity>
              }
            </View>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyIcon}>{discovering ? '📡' : '🔍'}</Text>
              <Text style={s.emptyTitle}>{discovering ? 'Searching...' : 'No devices found'}</Text>
              <Text style={s.emptyTxt}>{discovering ? 'Looking for nearby Kela-Konnect users' : 'Tap scan. Both devices need WiFi enabled.'}</Text>
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
        />

        <View style={s.tip}><Text style={s.tipTxt}>💡 Friends only — add contacts via QR first</Text></View>
      </View>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  bg:{flex:1}, overlay:{flex:1,backgroundColor:'rgba(0,0,0,0.38)'},
  header:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',paddingTop:60,paddingHorizontal:22,paddingBottom:16},
  eyebrow:{fontSize:10,fontWeight:'700',letterSpacing:3,color:'rgba(255,255,255,0.5)',marginBottom:4},
  title:{fontSize:34,fontWeight:'900',color:'#F5C842',letterSpacing:-1},
  badge:{borderRadius:20,paddingHorizontal:12,paddingVertical:6,borderWidth:1},
  badgeOn:{backgroundColor:'rgba(74,222,128,0.1)',borderColor:'rgba(74,222,128,0.3)'},
  badgeOff:{backgroundColor:'rgba(248,113,113,0.12)',borderColor:'rgba(248,113,113,0.3)'},
  badgeTxt:{fontSize:11,fontWeight:'700',color:'rgba(255,255,255,0.7)'},
  scanBtn:{backgroundColor:'#F5C842',borderRadius:16,paddingVertical:15,marginHorizontal:16,marginBottom:12,alignItems:'center',elevation:8},
  scanBtnStop:{backgroundColor:'rgba(248,113,113,0.85)'},
  scanBtnTxt:{fontSize:15,fontWeight:'900',color:'#1a1a1a'},
  scanningTxt:{fontSize:12,color:'#4ADE80',fontWeight:'600',paddingHorizontal:22,marginBottom:8},
  errorTxt:{fontSize:12,color:'#F87171',paddingHorizontal:22,marginBottom:8,fontWeight:'600'},
  countTxt:{fontSize:12,fontWeight:'700',color:'rgba(255,255,255,0.4)',paddingHorizontal:22,marginBottom:8,letterSpacing:1,textTransform:'uppercase'},
  card:{flexDirection:'row',alignItems:'center',gap:13,backgroundColor:'rgba(15,15,15,0.82)',borderWidth:1,borderColor:'rgba(255,255,255,0.07)',borderRadius:20,padding:14,marginBottom:10,elevation:12},
  cardDim:{opacity:0.6},
  avatar:{width:46,height:46,borderRadius:15,backgroundColor:'rgba(255,255,255,0.1)',alignItems:'center',justifyContent:'center'},
  avatarFriend:{backgroundColor:'#F5C842'},
  avatarTxt:{fontSize:20,fontWeight:'900',color:'#1a1a1a'},
  info:{flex:1}, nameRow:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:3},
  peerName:{fontSize:15,fontWeight:'800',color:'#fff'},
  friendTag:{backgroundColor:'rgba(245,200,66,0.15)',borderWidth:1,borderColor:'rgba(245,200,66,0.3)',borderRadius:6,paddingHorizontal:6,paddingVertical:2},
  friendTagTxt:{fontSize:9,fontWeight:'800',color:'#F5C842',letterSpacing:1},
  statusTxt:{fontSize:11,fontWeight:'700',marginBottom:2},
  mac:{fontSize:10,color:'rgba(255,255,255,0.2)',fontFamily:'monospace'},
  callBtn:{width:42,height:42,borderRadius:14,backgroundColor:'#F5C842',alignItems:'center',justifyContent:'center',elevation:6},
  callBtnTxt:{fontSize:18},
  qrBtn:{backgroundColor:'rgba(255,255,255,0.08)',borderWidth:1,borderColor:'rgba(255,255,255,0.12)',borderRadius:12,paddingHorizontal:12,paddingVertical:8},
  qrBtnTxt:{fontSize:11,fontWeight:'800',color:'rgba(255,255,255,0.6)'},
  empty:{alignItems:'center',paddingTop:60,paddingHorizontal:40},
  emptyIcon:{fontSize:56,marginBottom:16}, emptyTitle:{fontSize:20,fontWeight:'900',color:'#fff',marginBottom:8},
  emptyTxt:{fontSize:13,color:'rgba(255,255,255,0.4)',textAlign:'center',lineHeight:20},
  tip:{backgroundColor:'rgba(245,200,66,0.08)',borderTopWidth:1,borderTopColor:'rgba(245,200,66,0.12)',padding:14,alignItems:'center'},
  tipTxt:{fontSize:12,color:'rgba(245,200,66,0.7)',fontWeight:'600'},
});