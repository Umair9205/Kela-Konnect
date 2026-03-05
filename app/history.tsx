/**
 * history.tsx — Call history screen (FR-17, FR-18, FR-19, FR-20)
 */
import { router } from 'expo-router';
import { Alert, FlatList, ImageBackground, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CallRecord, useAppStore } from '../store/appStore';

const BG = require('../assets/images/banana-bg.png');

function fmt(s: number) { return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }

function timeAgo(d: Date): string {
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff/60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff/3_600_000)}h ago`;
  return d.toLocaleDateString();
}

const OUTCOME_ICON: Record<string, string> = { completed:'✅', missed:'📵', rejected:'🚫', failed:'❌' };
const DIR_ICON: Record<string, string> = { outgoing:'📤', incoming:'📥' };

export default function HistoryScreen() {
  const history       = useAppStore(s => s.callHistory);
  const deleteRecord  = useAppStore(s => s.deleteCallRecord);
  const clearHistory  = useAppStore(s => s.clearCallHistory);
  const getFriend     = useAppStore(s => s.getFriendByUUID);

  const handleCall = (record: CallRecord) => {
    const friend = getFriend(record.friendUUID);
    if (!friend) { Alert.alert('Contact not found', 'This contact is no longer in your friends list.'); return; }
    router.push({ pathname: '/call', params: { friendName: record.friendName, friendUUID: record.friendUUID } });
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete entry?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteRecord(id) },
    ]);
  };

  const handleClear = () => {
    Alert.alert('Clear all history?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: clearHistory },
    ]);
  };

  return (
    <ImageBackground source={BG} style={s.bg} resizeMode="cover">
      <StatusBar barStyle="light-content" />
      <View style={s.overlay}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.back}><Text style={s.backTxt}>‹ Back</Text></TouchableOpacity>
          <Text style={s.title}>Call History</Text>
          {history.length > 0 && <TouchableOpacity onPress={handleClear}><Text style={s.clearTxt}>Clear All</Text></TouchableOpacity>}
        </View>

        <FlatList
          data={history}
          keyExtractor={r => r.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.card} onLongPress={() => handleDelete(item.id)} onPress={() => handleCall(item)}>
              <View style={s.iconBox}><Text style={s.outcomeIcon}>{OUTCOME_ICON[item.outcome]}</Text></View>
              <View style={s.info}>
                <View style={s.nameRow}>
                  <Text style={s.name}>{item.friendName}</Text>
                  <Text style={s.dir}>{DIR_ICON[item.direction]} {item.direction}</Text>
                </View>
                <Text style={s.meta}>{timeAgo(item.startedAt)} · {item.outcome}</Text>
                {item.duration > 0 && <Text style={s.dur}>Duration: {fmt(item.duration)}</Text>}
              </View>
              <TouchableOpacity style={s.callBtn} onPress={() => handleCall(item)} accessibilityLabel="Call back" accessibilityRole="button">
                <Text>📞</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyIcon}>📋</Text>
              <Text style={s.emptyTitle}>No call history</Text>
              <Text style={s.emptyTxt}>Completed calls will appear here</Text>
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
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
  clearTxt:{fontSize:13,color:'#F87171',fontWeight:'700'},
  card:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'rgba(15,15,15,0.82)',borderWidth:1,borderColor:'rgba(255,255,255,0.07)',borderRadius:18,padding:14,marginBottom:10,elevation:8},
  iconBox:{width:44,height:44,borderRadius:14,backgroundColor:'rgba(255,255,255,0.07)',alignItems:'center',justifyContent:'center'},
  outcomeIcon:{fontSize:20}, info:{flex:1},
  nameRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  name:{fontSize:15,fontWeight:'800',color:'#fff'},
  dir:{fontSize:11,color:'rgba(255,255,255,0.4)',fontWeight:'600'},
  meta:{fontSize:12,color:'rgba(255,255,255,0.4)',marginTop:2},
  dur:{fontSize:12,color:'#F5C842',fontWeight:'600',marginTop:1},
  callBtn:{width:36,height:36,borderRadius:12,backgroundColor:'rgba(245,200,66,0.15)',alignItems:'center',justifyContent:'center'},
  empty:{alignItems:'center',paddingTop:80},
  emptyIcon:{fontSize:56,marginBottom:16}, emptyTitle:{fontSize:20,fontWeight:'900',color:'#fff',marginBottom:8},
  emptyTxt:{fontSize:13,color:'rgba(255,255,255,0.4)'},
});