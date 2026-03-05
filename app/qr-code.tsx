/**
 * qr-code.tsx — Show your QR code for friends to scan
 * Contains: UUID + name as JSON
 */
import { router } from 'expo-router';
import { ImageBackground, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useAppStore } from '../store/appStore';

const BG = require('../assets/images/banana-bg.png');

export default function QRCodeScreen() {
  const myUUID = useAppStore(s => s.myUUID);
  const myName = useAppStore(s => s.myDeviceName);

  const qrData = JSON.stringify({ uuid: myUUID ?? '', name: myName ?? '' });

  return (
    <ImageBackground source={BG} style={s.bg} resizeMode="cover">
      <StatusBar barStyle="light-content" />
      <View style={s.overlay}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.back}><Text style={s.backTxt}>‹ Back</Text></TouchableOpacity>
          <Text style={s.title}>My QR Code</Text>
          <View style={{width:60}} />
        </View>

        <View style={s.content}>
          <View style={s.card}>
            <Text style={s.name}>{myName}</Text>
            <Text style={s.sub}>Let friends scan this to add you</Text>
            <View style={s.qrBox}>
              <QRCode
                value={qrData}
                size={220}
                backgroundColor="#fff"
                color="#1a1a1a"
              />
            </View>
            <Text style={s.uuid}>{myUUID?.slice(0,8).toUpperCase()}...</Text>
          </View>
          <Text style={s.hint}>Point their camera at this code</Text>
        </View>
      </View>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  bg:{flex:1}, overlay:{flex:1,backgroundColor:'rgba(0,0,0,0.5)'},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingTop:60,paddingHorizontal:22,paddingBottom:16},
  back:{padding:4}, backTxt:{fontSize:17,color:'#F5C842',fontWeight:'700'},
  title:{fontSize:20,fontWeight:'900',color:'#fff'},
  content:{flex:1,alignItems:'center',justifyContent:'center',paddingHorizontal:24},
  card:{backgroundColor:'rgba(15,15,15,0.9)',borderRadius:28,padding:28,alignItems:'center',borderWidth:1,borderColor:'rgba(255,255,255,0.08)',width:'100%',gap:12},
  name:{fontSize:24,fontWeight:'900',color:'#fff'},
  sub:{fontSize:13,color:'rgba(255,255,255,0.4)'},
  qrBox:{backgroundColor:'#fff',borderRadius:20,padding:16,marginVertical:8},
  uuid:{fontSize:12,fontFamily:'monospace',color:'rgba(255,255,255,0.25)'},
  hint:{fontSize:13,color:'rgba(255,255,255,0.35)',marginTop:16,fontWeight:'600'},
});