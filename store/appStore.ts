import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface Friend {
  uuid: string; name: string; currentMac: string;
  addedDate: Date; lastSeen?: Date; autoAccept?: boolean;
}
export type CallDirection = 'outgoing' | 'incoming';
export type CallOutcome   = 'completed' | 'missed' | 'rejected' | 'failed';
export interface CallRecord {
  id: string; friendUUID: string; friendName: string;
  direction: CallDirection; outcome: CallOutcome; startedAt: Date; duration: number;
}
export type AudioQuality = 'low' | 'medium' | 'high';
export interface AppSettings {
  audioQuality: AudioQuality; ringtoneEnabled: boolean;
  speakerDefault: boolean; scanningEnabled: boolean;
}
const KEYS = { friends:'@kela_friends_v2', uuid:'@kela_my_uuid', name:'@kela_my_name', history:'@kela_call_history', settings:'@kela_settings' };
const DEFAULT_SETTINGS: AppSettings = { audioQuality:'high', ringtoneEnabled:true, speakerDefault:false, scanningEnabled:true };

interface AppState {
  myUUID: string|null; myDeviceName: string|null; friends: Friend[];
  callHistory: CallRecord[]; settings: AppSettings; isSetupDone: boolean;
  initIdentity:(name:string)=>Promise<void>; setMyDeviceName:(name:string)=>Promise<void>;
  addFriend:(f:Omit<Friend,'addedDate'>)=>Promise<void>; removeFriend:(uuid:string)=>Promise<void>;
  updateFriendMac:(uuid:string,mac:string)=>void; setAutoAccept:(uuid:string,val:boolean)=>Promise<void>;
  isFriendByUUID:(uuid:string)=>boolean; isFriendByName:(name:string)=>boolean;
  getFriendByUUID:(uuid:string)=>Friend|undefined; getCurrentMac:(uuid:string)=>string|null;
  addCallRecord:(r:Omit<CallRecord,'id'>)=>Promise<void>; deleteCallRecord:(id:string)=>Promise<void>;
  clearCallHistory:()=>Promise<void>; updateSettings:(p:Partial<AppSettings>)=>Promise<void>; loadData:()=>Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  myUUID:null, myDeviceName:null, friends:[], callHistory:[], settings:DEFAULT_SETTINGS, isSetupDone:false,
  initIdentity: async(name)=>{
    try{
      let uuid=await AsyncStorage.getItem(KEYS.uuid);
      if(!uuid){uuid=generateUUID();await AsyncStorage.setItem(KEYS.uuid,uuid);}
      await AsyncStorage.setItem(KEYS.name,name);
      set({myUUID:uuid,myDeviceName:name,isSetupDone:true});
    }catch(e){console.error('initIdentity:',e);throw e;}
  },
  setMyDeviceName: async(name)=>{await AsyncStorage.setItem(KEYS.name,name);set({myDeviceName:name});},
  addFriend: async(friend)=>{
    const ex=get().friends; const idx=ex.findIndex(f=>f.uuid===friend.uuid);
    const updated=idx>=0?ex.map((f,i)=>i===idx?{...f,...friend}:f):[...ex,{...friend,addedDate:new Date()}];
    set({friends:updated}); await AsyncStorage.setItem(KEYS.friends,JSON.stringify(updated));
  },
  removeFriend: async(uuid)=>{const f=get().friends.filter(f=>f.uuid!==uuid);set({friends:f});await AsyncStorage.setItem(KEYS.friends,JSON.stringify(f));},
  updateFriendMac: (uuid,mac)=>{
    const f=get().friends.map(f=>f.uuid===uuid?{...f,currentMac:mac,lastSeen:new Date()}:f);
    set({friends:f}); AsyncStorage.setItem(KEYS.friends,JSON.stringify(f));
  },
  setAutoAccept: async(uuid,val)=>{const f=get().friends.map(f=>f.uuid===uuid?{...f,autoAccept:val}:f);set({friends:f});await AsyncStorage.setItem(KEYS.friends,JSON.stringify(f));},
  isFriendByUUID:(uuid)=>get().friends.some(f=>f.uuid===uuid),
  isFriendByName:(name)=>get().friends.some(f=>f.name===name),
  getFriendByUUID:(uuid)=>get().friends.find(f=>f.uuid===uuid),
  getCurrentMac:(uuid)=>get().friends.find(f=>f.uuid===uuid)?.currentMac||null,
  addCallRecord: async(record)=>{
    const history=[{...record,id:generateUUID()},...get().callHistory].slice(0,500);
    set({callHistory:history}); await AsyncStorage.setItem(KEYS.history,JSON.stringify(history));
  },
  deleteCallRecord: async(id)=>{const h=get().callHistory.filter(r=>r.id!==id);set({callHistory:h});await AsyncStorage.setItem(KEYS.history,JSON.stringify(h));},
  clearCallHistory: async()=>{set({callHistory:[]});await AsyncStorage.removeItem(KEYS.history);},
  updateSettings: async(patch)=>{const s={...get().settings,...patch};set({settings:s});await AsyncStorage.setItem(KEYS.settings,JSON.stringify(s));},
  loadData: async()=>{
    try{
      const[fr,uuid,name,hr,sr]=await Promise.all([AsyncStorage.getItem(KEYS.friends),AsyncStorage.getItem(KEYS.uuid),AsyncStorage.getItem(KEYS.name),AsyncStorage.getItem(KEYS.history),AsyncStorage.getItem(KEYS.settings)]);
      const u:any={};
      if(fr)u.friends=JSON.parse(fr).map((f:any)=>({...f,addedDate:new Date(f.addedDate),lastSeen:f.lastSeen?new Date(f.lastSeen):undefined}));
      if(hr)u.callHistory=JSON.parse(hr).map((r:any)=>({...r,startedAt:new Date(r.startedAt)}));
      if(sr)u.settings={...DEFAULT_SETTINGS,...JSON.parse(sr)};
      if(uuid)u.myUUID=uuid; if(name){u.myDeviceName=name;u.isSetupDone=true;}
      set(u);
    }catch(e){console.error('loadData:',e);}
  },
}));