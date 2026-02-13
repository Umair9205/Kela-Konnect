import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export interface Friend {
  id: string;
  name: string;
  addedDate: Date;
  isOnline?: boolean;
  lastSeen?: Date;
}

export interface ScannedDevice {
  id: string;
  name: string;
  rssi: number;
  lastSeen: Date;
}

interface AppState {
  // User's own info
  myDeviceId: string | null;
  myDeviceName: string | null;
  
  // Friends
  friends: Friend[];
  
  // Scanned devices
  scannedDevices: ScannedDevice[];
  
  // Advertising state
  isAdvertising: boolean;
  
  // Actions
  setMyDeviceInfo: (id: string, name: string) => void;
  addFriend: (friend: Friend) => Promise<void>;
  removeFriend: (id: string) => Promise<void>;
  loadFriends: () => Promise<void>;
  updateScannedDevices: (devices: ScannedDevice[]) => void;
  addScannedDevice: (device: ScannedDevice) => void;
  setAdvertising: (isAdvertising: boolean) => void;
  isFriend: (deviceId: string) => boolean;
}

const FRIENDS_KEY = '@kela_friends';
const MY_INFO_KEY = '@kela_my_info';

export const useAppStore = create<AppState>((set, get) => ({
  myDeviceId: null,
  myDeviceName: null,
  friends: [],
  scannedDevices: [],
  isAdvertising: false,

  setMyDeviceInfo: async (id, name) => {
    set({ myDeviceId: id, myDeviceName: name });
    await AsyncStorage.setItem(MY_INFO_KEY, JSON.stringify({ id, name }));
  },

  addFriend: async (friend) => {
    const friends = [...get().friends, friend];
    set({ friends });
    await AsyncStorage.setItem(FRIENDS_KEY, JSON.stringify(friends));
  },

  removeFriend: async (id) => {
    const friends = get().friends.filter(f => f.id !== id);
    set({ friends });
    await AsyncStorage.setItem(FRIENDS_KEY, JSON.stringify(friends));
  },

  loadFriends: async () => {
    try {
      const [friendsData, myInfoData] = await Promise.all([
        AsyncStorage.getItem(FRIENDS_KEY),
        AsyncStorage.getItem(MY_INFO_KEY)
      ]);

      if (friendsData) {
        const parsed = JSON.parse(friendsData);
        set({ 
          friends: parsed.map((f: any) => ({
            ...f,
            addedDate: new Date(f.addedDate)
          }))
        });
      }

      if (myInfoData) {
        const { id, name } = JSON.parse(myInfoData);
        set({ myDeviceId: id, myDeviceName: name });
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  },

  updateScannedDevices: (devices) => {
    set({ scannedDevices: devices });
  },

  addScannedDevice: (device) => {
    const devices = get().scannedDevices;
    const existingIndex = devices.findIndex(d => d.id === device.id);
    
    if (existingIndex >= 0) {
      devices[existingIndex] = device;
      set({ scannedDevices: [...devices] });
    } else {
      set({ scannedDevices: [...devices, device] });
    }
  },

  setAdvertising: (isAdvertising) => {
    set({ isAdvertising });
  },

  isFriend: (deviceId) => {
    return get().friends.some(f => f.id === deviceId);
  },
}));