import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { AppShell } from '@/components/app-shell';
import { palette } from '@/components/theme';
import { subscribeToAuthState, User } from '@/lib/auth';
import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function Devices() {
  const [user, setUser] = useState<User | null>(null);
  const [devices, setDevices] = useState<any[]>([]);

  useEffect(() => subscribeToAuthState(setUser), []);
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'devices'), where('uid', '==', user.uid));
    return onSnapshot(q, (snap) => setDevices(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [user?.uid]);

  return <AppShell title="Device Control">{devices.map((d)=> <View key={d.id} style={styles.card}><Text style={styles.name}>{d.name}</Text><Text style={styles.meta}>Temp {d.temperature ?? '--'}°C • Humidity {d.humidity ?? '--'}%</Text><Switch value={!!d.isOn} onValueChange={(value) => updateDoc(doc(db, 'devices', d.id), { isOn: value })} /></View>)}</AppShell>;
}
const styles=StyleSheet.create({card:{backgroundColor:'#1E1E1E',borderRadius:18,padding:16,marginBottom:12,borderWidth:1,borderColor:palette.border},name:{color:palette.text,fontWeight:'700'},meta:{color:palette.muted,marginVertical:8}});
