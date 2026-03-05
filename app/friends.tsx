/**
 * friends.tsx — Friends list management (FR-4, FR-5, FR-6, FR-30)
 */
import { router } from 'expo-router';
import { Alert, FlatList, ImageBackground, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Friend, useAppStore } from '../store/appStore';

const BG = require('../assets/images/banana-bg.png');

function timeAgo(d?: Date): string {
  if (!d) return 'Never seen';
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff/60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff/3_600_000)}h ago`;
  return d.toLocaleDateString();
}

export default function FriendsScreen() {
  const friends      = useAppStore(s => s.friends);
  const removeFriend = useAppStore(s => s.removeFriend);
  const setAutoAccept = useAppStore(s => s.setAutoAccept);

  const confirmRemove = (f: Friend) => {
    Alert.alert(`Remove ${f.name}?`, 'They will need to re-add you via QR to call again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeFriend(f.uuid) },
    ]);
  };

  const callFriend = (f: Friend) => {
    router.push({ pathname: '/call', params: { friendName: f.name, friendUUID: f.uuid } });
  };

  return (
    <ImageBackground source={BG} style={s.bg} resizeMode="cover">
      <StatusBar barStyle="light-content" />
      <View style={s.overlay}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.back}><Text style={s.backTxt}>‹ Back</Text></TouchableOpacity>
          <Text style={s.title}>Friends</Text>
          <TouchableOpacity onPress={() => router.push('/qr-scanner')} accessibilityLabel="Add friend via QR" accessibilityRole="button">
            <Text style={s.addTxt}>+ Add</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={friends}
          keyExtractor={f => f.uuid}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.avatar}><Text style={s.avatarTxt}>{item.name[0]?.toUpperCase()}</Text></View>
              <View style={s.info}>
                <Text style={s.name}>{item.name}</Text>
                <Text style={s.meta}>Last seen: {timeAgo(item.lastSeen)}</Text>
                {item.currentMac ? <Text style={s.mac}>{item.currentMac}</Text> : null}
              </View>
              <View style={s.actions}>
                <TouchableOpacity
                  style={[s.autoBtn, item.autoAccept && s.autoBtnOn]}
                  onPress={() => setAutoAccept(item.uuid, !item.autoAccept)}
                  accessibilityLabel={`Auto-accept calls from ${item.name}`}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: !!item.autoAccept }}
                >
                  <Text style={s.autoBtnTxt}>{item.autoAccept ? '⚡ Auto' : '⚡'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.callBtn} onPress={() => callFriend(item)} accessibilityLabel={`Call ${item.name}`} accessibilityRole="button">
                  <Text style={s.callBtnTxt}>📞</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmRemove(item)} accessibilityLabel={`Remove ${item.name}`} accessibilityRole="button">
                  <Text style={s.removeTxt}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyIcon}>👥</Text>
              <Text style={s.emptyTitle}>No friends yet</Text>
              <Text style={s.emptyTxt}>Add contacts by scanning their QR code</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/qr-scanner')}>
                <Text style={s.emptyBtnTxt}>Scan QR Code →</Text>
              </TouchableOpacity>
            </View>
          }
          contentContainerStyle={{ paddingHorizontal:16, paddingBottom:24 }}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  bg:{flex:1}, overlay:{flex:1,backgroundColor:'rgba(0,0,0,0.45)'},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingTop:60,paddingHorizontal:22,paddingBottom:16},
  back:{padding:4}, backTxt:{fontSize:17,color:'#F5C842',fontWeight:'700'},
  title:{fontSize:20,fontWeight:'900',color:'#fff'},
  addTxt:{fontSize:15,color:'#F5C842',fontWeight:'700'},
  card:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'rgba(15,15,15,0.85)',borderWidth:1,borderColor:'rgba(255,255,255,0.07)',borderRadius:18,padding:14,marginBottom:10,elevation:8},
  avatar:{width:46,height:46,borderRadius:14,backgroundColor:'#F5C842',alignItems:'center',justifyContent:'center'},
  avatarTxt:{fontSize:20,fontWeight:'900',color:'#1a1a1a'},
  info:{flex:1}, name:{fontSize:15,fontWeight:'800',color:'#fff'},
  meta:{fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:2},
  mac:{fontSize:10,color:'rgba(255,255,255,0.2)',fontFamily:'monospace',marginTop:1},
  actions:{flexDirection:'row',alignItems:'center',gap:8},
  autoBtn:{backgroundColor:'rgba(255,255,255,0.08)',borderRadius:10,paddingHorizontal:8,paddingVertical:5},
  autoBtnOn:{backgroundColor:'rgba(245,200,66,0.15)',borderWidth:1,borderColor:'rgba(245,200,66,0.3)'},
  autoBtnTxt:{fontSize:11,fontWeight:'700',color:'rgba(255,255,255,0.6)'},
  callBtn:{width:36,height:36,borderRadius:12,backgroundColor:'rgba(245,200,66,0.15)',alignItems:'center',justifyContent:'center'},
  callBtnTxt:{fontSize:17},
  removeTxt:{fontSize:18,color:'rgba(248,113,113,0.5)',padding:4},
  empty:{alignItems:'center',paddingTop:80,paddingHorizontal:40},
  emptyIcon:{fontSize:56,marginBottom:16}, emptyTitle:{fontSize:20,fontWeight:'900',color:'#fff',marginBottom:8},
  emptyTxt:{fontSize:13,color:'rgba(255,255,255,0.4)',textAlign:'center'},
  emptyBtn:{marginTop:20,backgroundColor:'#F5C842',borderRadius:14,paddingVertical:12,paddingHorizontal:24},
  emptyBtnTxt:{fontSize:14,fontWeight:'900',color:'#1a1a1a'},
});