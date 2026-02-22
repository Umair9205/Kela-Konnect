import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Animated, ImageBackground, StatusBar,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useAppStore } from '../../store/appStore';

const BG = require('../../assets/images/banana-bg.png');

const CARDS = [
  { href: '/ble-test',      icon: '📡', label: 'Scan',      sub: 'Find nearby users',    tag: 'DISCOVER', primary: true  },
  { href: '/ble-advertise', icon: '📢', label: 'Broadcast', sub: 'Make yourself visible', tag: 'PRESENCE', primary: false },
  { href: '/friends',       icon: '👥', label: 'Friends',   sub: 'Manage your contacts',  tag: 'CONTACTS', primary: false },
  { href: '/qr-code',       icon: '📱', label: 'My QR',     sub: 'Share your identity',   tag: 'IDENTITY', primary: false },
];

export default function HomeScreen() {
  const loadData = useAppStore(s => s.loadData);
  const myName   = useAppStore(s => s.myDeviceName);
  const friends  = useAppStore(s => s.friends);

  const headerO   = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef(CARDS.map(() => new Animated.Value(0))).current;
  const pulse     = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadData();
    Animated.timing(headerO, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    Animated.stagger(80, cardAnims.map(a =>
      Animated.spring(a, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true })
    )).start();
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.9, duration: 950, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,   duration: 950, useNativeDriver: true }),
    ])).start();
  }, []);

  const nearby = friends.filter(f => !!f.currentMac).length;

  return (
    <ImageBackground source={BG} style={styles.bg} resizeMode="cover">
      <StatusBar barStyle="light-content" />
      <View style={styles.overlay}>

        {/* Header */}
        <Animated.View style={[styles.header, { opacity: headerO }]}>
          <View>
            <Text style={styles.eyebrow}>KELA-KONNECT</Text>
            <Text style={styles.headline}>Home</Text>
          </View>
          <View style={styles.pill}>
            <View style={styles.dotWrap}>
              <Animated.View style={[styles.dotRing, { transform: [{ scale: pulse }] }]} />
              <View style={[styles.dot, myName ? styles.dotOn : styles.dotOff]} />
            </View>
            <Text style={styles.pillName} numberOfLines={1}>{myName ?? 'Not set up'}</Text>
            {friends.length > 0 && (
              <View style={styles.friendsBadge}>
                <Text style={styles.friendsBadgeText}>Friends</Text>
                <View style={styles.friendsDivider} />
                <Text style={styles.friendsBadgeNum}>{friends.length}</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Cards */}
        <View style={styles.cardList}>
          {CARDS.map((card, i) => (
            <Animated.View
              key={card.href}
              style={[
                styles.cardAnimWrap,
                {
                  opacity: cardAnims[i],
                  transform: [{
                    translateY: cardAnims[i].interpolate({
                      inputRange: [0, 1], outputRange: [20, 0],
                    }),
                  }],
                },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.74}
                style={[styles.card, card.primary && styles.cardPrimary]}
                onPress={() => router.push(card.href as any)}
              >
                <View style={[styles.iconBox, card.primary && styles.iconBoxPrimary]}>
                  <Text style={styles.iconEmoji}>{card.icon}</Text>
                </View>

                <View style={styles.textCol}>
                  <View style={[styles.tagChip, card.primary && styles.tagChipPrimary]}>
                    <Text style={[styles.tagChipText, card.primary && styles.tagChipTextPrimary]}>
                      {card.tag}
                    </Text>
                  </View>
                  <Text style={[styles.cardLabel, card.primary && styles.cardLabelPrimary]}>
                    {card.label}
                  </Text>
                  <Text style={[styles.cardSub, card.primary && styles.cardSubPrimary]}>
                    {card.sub}
                  </Text>
                  {card.primary && nearby > 0 && (
                    <Text style={styles.nearbyText}>● {nearby} nearby now</Text>
                  )}
                </View>

                <View style={[styles.arrow, card.primary && styles.arrowPrimary]}>
                  <Text style={[styles.arrowText, card.primary && styles.arrowTextPrimary]}>→</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>

        {/* Footer */}
        <Animated.View style={[styles.footer, { opacity: headerO }]}>
          <Text style={styles.footerText}>BLE · Wi-Fi Direct · No Internet Required</Text>
        </Animated.View>

      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    paddingTop: 62,
    paddingBottom: 28,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    // Force full width
    alignSelf: 'stretch',
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  eyebrow: {
    fontSize: 10, fontWeight: '700', letterSpacing: 3,
    color: 'rgba(255,255,255,0.45)', marginBottom: 4,
  },
  headline: {
    fontSize: 36, fontWeight: '900', color: '#F5C842', letterSpacing: -1,
  },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(14,14,14,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 190,
  },
  dotWrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  dotRing: {
    position: 'absolute', width: 10, height: 10, borderRadius: 5,
    backgroundColor: 'rgba(74,222,128,0.3)',
  },
  dot:    { width: 6, height: 6, borderRadius: 3 },
  dotOn:  { backgroundColor: '#4ADE80' },
  dotOff: { backgroundColor: 'rgba(255,255,255,0.25)' },
  pillName: {
    fontSize: 11, fontWeight: '700', color: '#fff', flexShrink: 1,
  },
  friendsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F5C842', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  friendsBadgeText: { fontSize: 9, fontWeight: '800', color: '#1a1a1a' },
  friendsDivider:   { width: 1, height: 9, backgroundColor: 'rgba(26,26,26,0.3)' },
  friendsBadgeNum:  { fontSize: 10, fontWeight: '900', color: '#1a1a1a' },

  /* Cards */
  cardList: {
    flex: 1,
    justifyContent: 'center',
    gap: 12,
  },

  // This is the KEY fix — Animated.View must be full width
  cardAnimWrap: {
    width: '100%',
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(12,12,12,0.84)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 22,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
  },
  cardPrimary: {
    backgroundColor: '#F5C842',
    borderColor: 'transparent',
    shadowColor: '#F5C842',
    shadowOpacity: 0.3,
  },

  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  iconBoxPrimary: {
    backgroundColor: 'rgba(26,26,26,0.12)',
    borderColor: 'rgba(26,26,26,0.08)',
  },
  iconEmoji: { fontSize: 26 },

  textCol: {
    flex: 1,
    gap: 3,
  },
  tagChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245,200,66,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,200,66,0.22)',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 2,
  },
  tagChipPrimary: {
    backgroundColor: 'rgba(26,26,26,0.12)',
    borderColor: 'rgba(26,26,26,0.15)',
  },
  tagChipText: {
    fontSize: 8, fontWeight: '900', letterSpacing: 1.2, color: '#F5C842',
  },
  tagChipTextPrimary: { color: 'rgba(26,26,26,0.5)' },

  cardLabel: {
    fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: -0.3,
  },
  cardLabelPrimary: { color: '#1a1a1a' },

  cardSub: {
    fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.38)',
  },
  cardSubPrimary: { color: 'rgba(26,26,26,0.52)' },

  nearbyText: {
    fontSize: 11, fontWeight: '700', color: 'rgba(26,26,26,0.6)', marginTop: 2,
  },

  arrow: {
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 10, flexShrink: 0,
  },
  arrowPrimary: {
    backgroundColor: 'rgba(26,26,26,0.12)',
    borderColor: 'rgba(26,26,26,0.08)',
  },
  arrowText:        { fontSize: 16, color: 'rgba(255,255,255,0.45)', fontWeight: '700' },
  arrowTextPrimary: { color: 'rgba(26,26,26,0.5)' },

  /* Footer */
  footer: { alignItems: 'center', paddingTop: 8 },
  footerText: {
    fontSize: 10, fontWeight: '700', letterSpacing: 2,
    color: 'rgba(255,255,255,0.16)', textTransform: 'uppercase',
  },
});