import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { AppShell } from '@/components/app-shell';
import { palette } from '@/components/theme';
import { subscribeToAuthState, User } from '@/lib/auth';
import { db } from '@/lib/firebase';

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [devices, setDevices] = useState<any[]>([]);

  useEffect(() => subscribeToAuthState(setUser), []);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'devices'), where('uid', '==', user.uid));
    return onSnapshot(q, (snap) => setDevices(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [user?.uid]);

  const online = useMemo(() => devices.filter((d) => d.isOn).length, [devices]);

  return (
    <AppShell title="Dashboard">
      <Text style={styles.subtitle}>Welcome {user?.name ?? 'User'} • {user?.email ?? ''}</Text>
      <View style={styles.row}>
        {[`Connected Devices: ${devices.length}`, `Online: ${online}`, 'ESP32 System: Healthy'].map((t) => <View key={t} style={styles.card}><Text style={styles.cardText}>{t}</Text></View>)}
      </View>
    </AppShell>
  );
}
const styles = StyleSheet.create({ subtitle:{color:palette.muted}, row:{flexDirection:'row', gap:12, flexWrap:'wrap'}, card:{backgroundColor:'#1E1E1E', borderRadius:18, padding:16, minWidth:180, borderWidth:1,borderColor:palette.border}, cardText:{color:palette.text}});
