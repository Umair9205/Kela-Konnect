import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

// ─────────────────────────────────────────────────────────────
// UUID generator (no external lib needed)
// ─────────────────────────────────────────────────────────────
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export interface Friend {
  uuid: string;        // ✅ permanent identity (never changes)
  name: string;        // display name (can change)
  currentMac: string;  // latest known BLE MAC (updated each scan)
  addedDate: Date;
  isOnline?: boolean;
  lastSeen?: Date;
}

interface AppState {
  // My permanent identity
  myUUID: string | null;
  myDeviceName: string | null;

  // Friends stored by UUID
  friends: Friend[];

  // Advertising state
  isAdvertising: boolean;

  // Actions
  initIdentity: (name: string) => Promise<void>;
  setMyDeviceName: (name: string) => Promise<void>;
  addFriend: (friend: Friend) => Promise<void>;
  removeFriend: (uuid: string) => Promise<void>;
  loadData: () => Promise<void>;
  setAdvertising: (val: boolean) => void;

  // Friend lookups
  isFriendByUUID: (uuid: string) => boolean;
  isFriendByName: (name: string) => boolean;
  getFriendByUUID: (uuid: string) => Friend | undefined;
  updateFriendMac: (uuid: string, mac: string) => void;
  getCurrentMac: (uuid: string) => string | null;
}

// ─────────────────────────────────────────────────────────────
// Storage keys
// ─────────────────────────────────────────────────────────────
const FRIENDS_KEY  = '@kela_friends_v2';  // v2 = uuid-based
const MY_UUID_KEY  = '@kela_my_uuid';     // permanent, never overwritten
const MY_NAME_KEY  = '@kela_my_name';

// ─────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────
export const useAppStore = create<AppState>((set, get) => ({
  myUUID: null,
  myDeviceName: null,
  friends: [],
  isAdvertising: false,

  // Called on app start / before advertising
  // Generates UUID once on first install, never again
  initIdentity: async (name: string) => {
    try {
      // UUID: read existing or generate once
      let uuid = await AsyncStorage.getItem(MY_UUID_KEY);
      if (!uuid) {
        uuid = generateUUID();
        await AsyncStorage.setItem(MY_UUID_KEY, uuid);
        console.log(`🆔 New permanent UUID generated: ${uuid}`);
      } else {
        console.log(`🆔 Existing UUID loaded: ${uuid}`);
      }

      // Name: always update to latest
      await AsyncStorage.setItem(MY_NAME_KEY, name);
      set({ myUUID: uuid, myDeviceName: name });
    } catch (e) {
      console.error('❌ initIdentity error:', e);
    }
  },

  setMyDeviceName: async (name: string) => {
    await AsyncStorage.setItem(MY_NAME_KEY, name);
    set({ myDeviceName: name });
  },

  addFriend: async (friend: Friend) => {
    const existing = get().friends;
    // If already exists by UUID, update their info
    const idx = existing.findIndex(f => f.uuid === friend.uuid);
    let updated: Friend[];
    if (idx >= 0) {
      updated = [...existing];
      updated[idx] = { ...updated[idx], ...friend };
    } else {
      updated = [...existing, friend];
    }
    set({ friends: updated });
    await AsyncStorage.setItem(FRIENDS_KEY, JSON.stringify(updated));
  },

  removeFriend: async (uuid: string) => {
    const friends = get().friends.filter(f => f.uuid !== uuid);
    set({ friends });
    await AsyncStorage.setItem(FRIENDS_KEY, JSON.stringify(friends));
  },

  loadData: async () => {
    try {
      const [friendsData, uuid, name] = await Promise.all([
        AsyncStorage.getItem(FRIENDS_KEY),
        AsyncStorage.getItem(MY_UUID_KEY),
        AsyncStorage.getItem(MY_NAME_KEY),
      ]);

      if (friendsData) {
        const parsed = JSON.parse(friendsData);
        set({
          friends: parsed.map((f: any) => ({
            ...f,
            addedDate: new Date(f.addedDate),
          })),
        });
      }

      if (uuid) set({ myUUID: uuid });
      if (name) set({ myDeviceName: name });

    } catch (e) {
      console.error('❌ loadData error:', e);
    }
  },

  setAdvertising: (val) => set({ isAdvertising: val }),

  isFriendByUUID: (uuid) => get().friends.some(f => f.uuid === uuid),

  isFriendByName: (name) => get().friends.some(f => f.name === name),

  getFriendByUUID: (uuid) => get().friends.find(f => f.uuid === uuid),

  // Called every scan when we see a known friend's device
  // Silently updates their MAC without touching UUID or name
  updateFriendMac: (uuid, mac) => {
    const friends = get().friends.map(f =>
      f.uuid === uuid ? { ...f, currentMac: mac, lastSeen: new Date() } : f
    );
    set({ friends });
    // Persist silently
    AsyncStorage.setItem(FRIENDS_KEY, JSON.stringify(friends));
  },

  getCurrentMac: (uuid) => {
    return get().friends.find(f => f.uuid === uuid)?.currentMac || null;
  },
}));