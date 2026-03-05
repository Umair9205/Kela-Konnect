/**
 * settings.tsx — App settings screen (FR-28 to FR-32)
 */
import { router } from 'expo-router';
import { Alert, ImageBackground, ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useAppStore } from '../store/appStore';

const BG = require('../assets/images/banana-bg.png');

export default function SettingsScreen() {
  const settings       = useAppStore(s => s.settings);
  const updateSettings = useAppStore(s => s.updateSettings);
  const myName         = useAppStore(s => s.myDeviceName);
  const setMyDeviceName = useAppStore(s => s.setMyDeviceName);

  const qualityOptions: Array<{label:string;value:'low'|'medium'|'high';desc:string}> = [
    { label:'Low',    value:'low',    desc:'8kbps  · Best battery life' },
    { label:'Medium', value:'medium', desc:'16kbps · Balanced' },
    { label:'High',   value:'high',   desc:'32kbps · Best quality' },
  ];

  return (
    <ImageBackground source={BG} style={s.bg} resizeMode="cover">
      <StatusBar barStyle="light-content" />
      <View style={s.overlay}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.back}><Text style={s.backTxt}>‹ Back</Text></TouchableOpacity>
          <Text style={s.title}>Settings</Text>
          <View style={{width:60}} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal:16, paddingBottom:40 }}>

          {/* Audio Quality (FR-16, FR-29) */}
          <Text style={s.section}>AUDIO QUALITY</Text>
          <View style={s.card}>
            {qualityOptions.map((opt, i) => (
              <TouchableOpacity
                key={opt.value}
                style={[s.row, i < qualityOptions.length-1 && s.rowBorder]}
                onPress={() => updateSettings({ audioQuality: opt.value })}
                accessibilityRole="radio"
                accessibilityState={{ checked: settings.audioQuality === opt.value }}
              >
                <View style={s.rowInfo}>
                  <Text style={s.rowTitle}>{opt.label}</Text>
                  <Text style={s.rowDesc}>{opt.desc}</Text>
                </View>
                <View style={[s.radio, settings.audioQuality === opt.value && s.radioOn]}>
                  {settings.audioQuality === opt.value && <View style={s.radioDot} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Call Preferences (FR-30, FR-31) */}
          <Text style={s.section}>CALL PREFERENCES</Text>
          <View style={s.card}>
            <View style={[s.row, s.rowBorder]}>
              <View style={s.rowInfo}>
                <Text style={s.rowTitle}>Ringtone</Text>
                <Text style={s.rowDesc}>Vibrate on incoming calls</Text>
              </View>
              <Switch
                value={settings.ringtoneEnabled}
                onValueChange={v => updateSettings({ ringtoneEnabled: v })}
                trackColor={{ false:'rgba(255,255,255,0.1)', true:'rgba(245,200,66,0.5)' }}
                thumbColor={settings.ringtoneEnabled ? '#F5C842' : '#888'}
                accessibilityLabel="Toggle ringtone"
              />
            </View>
            <View style={[s.row, s.rowBorder]}>
              <View style={s.rowInfo}>
                <Text style={s.rowTitle}>Speaker by Default</Text>
                <Text style={s.rowDesc}>Start calls on speakerphone</Text>
              </View>
              <Switch
                value={settings.speakerDefault}
                onValueChange={v => updateSettings({ speakerDefault: v })}
                trackColor={{ false:'rgba(255,255,255,0.1)', true:'rgba(245,200,66,0.5)' }}
                thumbColor={settings.speakerDefault ? '#F5C842' : '#888'}
                accessibilityLabel="Toggle speaker default"
              />
            </View>
            <View style={s.row}>
              <View style={s.rowInfo}>
                <Text style={s.rowTitle}>WiFi Scanning</Text>
                <Text style={s.rowDesc}>Allow peer discovery (FR-28)</Text>
              </View>
              <Switch
                value={settings.scanningEnabled}
                onValueChange={v => updateSettings({ scanningEnabled: v })}
                trackColor={{ false:'rgba(255,255,255,0.1)', true:'rgba(245,200,66,0.5)' }}
                thumbColor={settings.scanningEnabled ? '#F5C842' : '#888'}
                accessibilityLabel="Toggle WiFi scanning"
              />
            </View>
          </View>

          {/* Profile */}
          <Text style={s.section}>PROFILE</Text>
          <View style={s.card}>
            <TouchableOpacity
              style={s.row}
              onPress={() => Alert.prompt('Change Name', 'Enter your new display name:', async (text) => {
                if (text?.trim()) await setMyDeviceName(text.trim());
              }, 'plain-text', myName ?? '')}
            >
              <View style={s.rowInfo}>
                <Text style={s.rowTitle}>Display Name</Text>
                <Text style={s.rowDesc}>{myName ?? '—'}</Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          </View>

          {/* About */}
          <Text style={s.section}>ABOUT</Text>
          <View style={s.card}>
            {[
              ['Protocol',   'WiFi Direct + WebRTC'],
              ['Encryption', 'DTLS-SRTP (AES-128)'],
              ['Signaling',  'TCP port 9875 (local)'],
              ['Servers',    'None — fully offline'],
              ['Version',    '1.0.0'],
            ].map(([k,v], i, arr) => (
              <View key={k} style={[s.row, i < arr.length-1 && s.rowBorder]}>
                <Text style={s.rowTitle}>{k}</Text>
                <Text style={s.rowVal}>{v}</Text>
              </View>
            ))}
          </View>

        </ScrollView>
      </View>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  bg:{flex:1}, overlay:{flex:1,backgroundColor:'rgba(0,0,0,0.45)'},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingTop:60,paddingHorizontal:22,paddingBottom:16},
  back:{padding:4}, backTxt:{fontSize:17,color:'#F5C842',fontWeight:'700'},
  title:{fontSize:20,fontWeight:'900',color:'#fff'},
  section:{fontSize:10,fontWeight:'800',letterSpacing:2,color:'rgba(255,255,255,0.35)',paddingHorizontal:6,marginTop:24,marginBottom:8,textTransform:'uppercase'},
  card:{backgroundColor:'rgba(15,15,15,0.85)',borderRadius:18,borderWidth:1,borderColor:'rgba(255,255,255,0.07)',overflow:'hidden'},
  row:{flexDirection:'row',alignItems:'center',padding:16,minHeight:56},
  rowBorder:{borderBottomWidth:1,borderBottomColor:'rgba(255,255,255,0.06)'},
  rowInfo:{flex:1},
  rowTitle:{fontSize:15,fontWeight:'700',color:'#fff'},
  rowDesc:{fontSize:12,color:'rgba(255,255,255,0.4)',marginTop:2},
  rowVal:{fontSize:13,color:'rgba(255,255,255,0.4)',fontWeight:'600'},
  radio:{width:22,height:22,borderRadius:11,borderWidth:2,borderColor:'rgba(255,255,255,0.2)',alignItems:'center',justifyContent:'center'},
  radioOn:{borderColor:'#F5C842'},
  radioDot:{width:10,height:10,borderRadius:5,backgroundColor:'#F5C842'},
  chevron:{fontSize:22,color:'rgba(255,255,255,0.25)',fontWeight:'300'},
});