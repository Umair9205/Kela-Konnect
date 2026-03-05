/**
 * qr-scanner.tsx — Scan a friend's QR code to add them (FR-4)
 * Uses expo-camera (bundled with Expo) for reliable QR scanning
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppStore } from '../store/appStore';

export default function QRScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const addFriend = useAppStore(s => s.addFriend);
  const isFriend  = useAppStore(s => s.isFriendByUUID);
  const scanLock  = useRef(false);

  const handleBarcode = ({ data }: { data: string }) => {
    if (scanLock.current) return;
    scanLock.current = true;
    setScanned(true);
    try {
      const parsed = JSON.parse(data);
      if (!parsed.uuid || !parsed.name) throw new Error('Invalid QR');
      if (isFriend(parsed.uuid)) {
        Alert.alert('Already a friend', `${parsed.name} is already in your contacts.`, [
          { text:'OK', onPress:()=>router.back() }
        ]);
      } else {
        Alert.alert(`Add ${parsed.name}?`, 'They will be added to your friends list.', [
          { text:'Cancel', style:'cancel', onPress:() => { setScanned(false); scanLock.current = false; } },
          { text:'Add Friend', onPress: async () => {
            await addFriend({ uuid: parsed.uuid, name: parsed.name, currentMac: '' });
            Alert.alert('Added!', `${parsed.name} is now your friend.`, [{ text:'OK', onPress:()=>router.back() }]);
          }},
        ]);
      }
    } catch (_) {
      Alert.alert('Invalid QR', 'This is not a valid Kela-Konnect QR code.', [
        { text:'Retry', onPress:() => { setScanned(false); scanLock.current = false; } }
      ]);
    }
  };

  if (!permission) return <View style={s.center}><Text style={s.txt}>Requesting camera...</Text></View>;

  if (!permission.granted) {
    return (
      <View style={[s.center, s.dark]}>
        <Text style={s.txt}>Camera permission needed to scan QR codes</Text>
        <TouchableOpacity style={s.btn} onPress={requestPermission}>
          <Text style={s.btnTxt}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.cancel} onPress={() => router.back()}>
          <Text style={s.cancelTxt}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.full}>
      <CameraView
        style={s.full}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarcode}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />
      <View style={s.ui}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backTxt}>✕  Cancel</Text>
        </TouchableOpacity>
        <View style={s.finder}>
          <View style={[s.corner,s.tl]} /><View style={[s.corner,s.tr]} />
          <View style={[s.corner,s.bl]} /><View style={[s.corner,s.br]} />
        </View>
        <Text style={s.hint}>Point at a friend's QR code</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  full:{flex:1},
  dark:{flex:1,backgroundColor:'#111'},
  center:{flex:1,alignItems:'center',justifyContent:'center',padding:32,gap:16},
  txt:{fontSize:15,color:'#fff',textAlign:'center'},
  btn:{backgroundColor:'#F5C842',borderRadius:14,paddingVertical:12,paddingHorizontal:24},
  btnTxt:{fontSize:14,fontWeight:'900',color:'#1a1a1a'},
  cancel:{padding:12},
  cancelTxt:{fontSize:14,color:'rgba(255,255,255,0.5)'},
  ui:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'space-between',paddingVertical:70,paddingHorizontal:32},
  backBtn:{alignSelf:'flex-start',backgroundColor:'rgba(0,0,0,0.5)',borderRadius:20,paddingHorizontal:16,paddingVertical:8},
  backTxt:{fontSize:15,color:'#fff',fontWeight:'700'},
  finder:{width:240,height:240},
  corner:{width:32,height:32,borderColor:'#F5C842',position:'absolute'},
  tl:{top:0,left:0,borderTopWidth:3,borderLeftWidth:3,borderTopLeftRadius:8},
  tr:{top:0,right:0,borderTopWidth:3,borderRightWidth:3,borderTopRightRadius:8},
  bl:{bottom:0,left:0,borderBottomWidth:3,borderLeftWidth:3,borderBottomLeftRadius:8},
  br:{bottom:0,right:0,borderBottomWidth:3,borderRightWidth:3,borderBottomRightRadius:8},
  hint:{fontSize:14,color:'rgba(255,255,255,0.8)',fontWeight:'600'},
});