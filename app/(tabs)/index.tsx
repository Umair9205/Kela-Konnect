/**
 * (tabs)/index.tsx — Home screen dashboard
 */
import { router } from 'expo-router';
import { ImageBackground, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppStore } from '../../store/appStore';

const BG = require('../../assets/images/banana-bg.png');

interface CardProps {
  icon: string; title: string; desc: string; onPress: () => void; accent?: string;
}
function Card({ icon, title, desc, onPress, accent='#F5C842' }: CardProps) {
  return (
    <TouchableOpacity style={c.card} onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
      <View style={[c.cardIcon, {backgroundColor: accent+'22', borderColor: accent+'33'}]}>
        <Text style={c.cardIconTxt}>{icon}</Text>
      </View>
      <Text style={c.cardTitle}>{title}</Text>
      <Text style={c.cardDesc}>{desc}</Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const myName     = useAppStore(s => s.myDeviceName);
  const friends    = useAppStore(s => s.friends);
  const history    = useAppStore(s => s.callHistory);
  const isSetupDone = useAppStore(s => s.isSetupDone);

  const recentFriends = friends.filter(f => f.lastSeen).sort((a,b) =>
    (b.lastSeen?.getTime()??0) - (a.lastSeen?.getTime()??0)
  ).slice(0,3);

  const missedCalls = history.filter(r => r.outcome === 'missed').length;

  return (
    <ImageBackground source={BG} style={c.bg} resizeMode="cover">
      <StatusBar barStyle="light-content" />
      <ScrollView style={c.scroll} showsVerticalScrollIndicator={false}>
        <View style={c.top}>
          <Text style={c.eyebrow}>KELA-KONNECT</Text>
          <Text style={c.welcome}>Hello, {myName ?? 'there'} 👋</Text>
          <Text style={c.sub}>Offline P2P voice calling</Text>
          <View style={c.statsRow}>
            <View style={c.stat}><Text style={c.statNum}>{friends.length}</Text><Text style={c.statLbl}>Friends</Text></View>
            <View style={c.statDiv} />
            <View style={c.stat}><Text style={c.statNum}>{history.length}</Text><Text style={c.statLbl}>Calls</Text></View>
            <View style={c.statDiv} />
            <View style={c.stat}><Text style={[c.statNum, missedCalls>0 && {color:'#F87171'}]}>{missedCalls}</Text><Text style={c.statLbl}>Missed</Text></View>
          </View>
        </View>

        <View style={c.grid}>
          <Card icon="📡" title="Discover"   desc="Find nearby users"     onPress={() => router.push('/discover')} />
          <Card icon="👥" title="Friends"    desc={`${friends.length} contacts`} onPress={() => router.push('/friends')} />
          <Card icon="📋" title="History"    desc="Recent calls"          onPress={() => router.push('/history')} accent="#4ADE80" />
          <Card icon="📷" title="My QR"      desc="Share your contact"    onPress={() => router.push('/qr-code')} accent="#60A5FA" />
          <Card icon="⚙️"  title="Settings"  desc="Audio & preferences"   onPress={() => router.push('/settings')} accent="#A78BFA" />
          <Card icon="➕" title="Add Friend" desc="Scan QR code"          onPress={() => router.push('/qr-scanner')} accent="#F87171" />
        </View>

        {recentFriends.length > 0 && (
          <View style={c.section}>
            <Text style={c.sectionTitle}>RECENTLY SEEN</Text>
            {recentFriends.map(f => (
              <TouchableOpacity
                key={f.uuid}
                style={c.friendRow}
                onPress={() => router.push({ pathname:'/call', params:{ friendName:f.name, friendUUID:f.uuid } })}
                accessibilityRole="button"
                accessibilityLabel={`Call ${f.name}`}
              >
                <View style={c.fAvatar}><Text style={c.fAvatarTxt}>{f.name[0]?.toUpperCase()}</Text></View>
                <View style={c.fInfo}>
                  <Text style={c.fName}>{f.name}</Text>
                  <Text style={c.fMeta}>{f.currentMac || 'No MAC yet'}</Text>
                </View>
                <Text style={c.fCall}>📞</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={c.footer}>
          <Text style={c.footerTxt}>No internet required · DTLS-SRTP encrypted · No servers</Text>
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

const c = StyleSheet.create({
  bg:{flex:1}, scroll:{flex:1},
  top:{paddingTop:70,paddingHorizontal:24,paddingBottom:24,backgroundColor:'rgba(0,0,0,0.4)'},
  eyebrow:{fontSize:10,fontWeight:'700',letterSpacing:4,color:'rgba(255,255,255,0.4)',marginBottom:6},
  welcome:{fontSize:30,fontWeight:'900',color:'#fff',letterSpacing:-0.5},
  sub:{fontSize:14,color:'rgba(255,255,255,0.4)',marginTop:4,fontWeight:'600'},
  statsRow:{flexDirection:'row',alignItems:'center',backgroundColor:'rgba(255,255,255,0.05)',borderRadius:16,padding:16,marginTop:20,borderWidth:1,borderColor:'rgba(255,255,255,0.08)'},
  stat:{flex:1,alignItems:'center'},
  statNum:{fontSize:24,fontWeight:'900',color:'#F5C842'},
  statLbl:{fontSize:11,color:'rgba(255,255,255,0.4)',fontWeight:'600',marginTop:2},
  statDiv:{width:1,height:32,backgroundColor:'rgba(255,255,255,0.08)'},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:12,padding:16,backgroundColor:'rgba(0,0,0,0.15)'},
  card:{width:'47%',backgroundColor:'rgba(15,15,15,0.85)',borderRadius:20,padding:18,borderWidth:1,borderColor:'rgba(255,255,255,0.07)',gap:8},
  cardIcon:{width:44,height:44,borderRadius:14,alignItems:'center',justifyContent:'center',borderWidth:1},
  cardIconTxt:{fontSize:22},
  cardTitle:{fontSize:15,fontWeight:'900',color:'#fff'},
  cardDesc:{fontSize:12,color:'rgba(255,255,255,0.35)'},
  section:{paddingHorizontal:16,paddingBottom:8,backgroundColor:'rgba(0,0,0,0.15)'},
  sectionTitle:{fontSize:10,fontWeight:'800',letterSpacing:2,color:'rgba(255,255,255,0.3)',marginBottom:10,paddingHorizontal:4},
  friendRow:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'rgba(15,15,15,0.82)',borderRadius:16,padding:12,marginBottom:8,borderWidth:1,borderColor:'rgba(255,255,255,0.06)'},
  fAvatar:{width:40,height:40,borderRadius:12,backgroundColor:'#F5C842',alignItems:'center',justifyContent:'center'},
  fAvatarTxt:{fontSize:18,fontWeight:'900',color:'#1a1a1a'},
  fInfo:{flex:1}, fName:{fontSize:14,fontWeight:'800',color:'#fff'}, fMeta:{fontSize:11,color:'rgba(255,255,255,0.3)'},
  fCall:{fontSize:20,padding:4},
  footer:{padding:24,alignItems:'center',backgroundColor:'rgba(0,0,0,0.2)'},
  footerTxt:{fontSize:11,color:'rgba(255,255,255,0.2)',textAlign:'center',lineHeight:18,fontWeight:'600'},
});