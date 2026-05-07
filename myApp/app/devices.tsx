import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppShell } from '@/components/app-shell';
import { palette } from '@/components/theme';
import { subscribeToAuthState, User } from '@/lib/auth';
import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const lastSeenToMillis = (lastSeen: any) => {
  if (!lastSeen) return 0;
  if (typeof lastSeen.toMillis === 'function') return lastSeen.toMillis();
  if (typeof lastSeen.seconds === 'number') return lastSeen.seconds * 1000;
  if (typeof lastSeen === 'number') return lastSeen;
  return 0;
};

const isDeviceConnected = (device: any) => {
  const heartbeatFresh = Date.now() - lastSeenToMillis(device.lastSeen) < 45000;
  return Boolean(device.isConnected || device.online || device.isOn || heartbeatFresh) && device.connectionStatus !== 'Disconnected';
};

export default function Devices() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [devices, setDevices] = useState<any[]>([]);

  useEffect(() => subscribeToAuthState(setUser), []);
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'devices'), where('uid', '==', user.uid));
    return onSnapshot(q, (snap) => setDevices(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [user?.uid]);

  return (
    <AppShell title="Device Control">
      <ScrollView contentContainerStyle={styles.container}>
        {devices.map((d) => {
          const isEsp32 = d.type === 'esp32-vendo' || d.deviceId;
          const connected = isDeviceConnected(d);
          return (
            <View key={d.id} style={styles.card}>
              <Text style={styles.name}>{d.name}</Text>
              {isEsp32 ? (
                <>
                  <Text style={styles.meta}>{connected ? 'Connected' : 'Disconnected'}</Text>
                  <Text style={styles.meta}>Remaining {d.remainingTime ?? '--'}s • Usage {d.totalTimeUsed ?? '--'}s</Text>
                  <Text style={styles.meta}>Sales ₱{d.salesToday ?? '--'} • Total ₱{d.totalEarnings ?? '--'}</Text>
                  <Text style={styles.meta}>Pricing ₱{d.minCreditsToStart ?? '--'} = {Math.round((d.secondsForMinCredits ?? 0) / 60) || '--'} min</Text>
                  <Pressable
                    style={styles.button}
                    onPress={() => router.push({ pathname: '/vendo-control', params: { ip: d.ip, token: d.authToken, deviceId: d.deviceId } })}>
                    <Text style={styles.buttonText}>Open ESP32 Controls</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.meta}>Temp {d.temperature ?? '--'}°C • Humidity {d.humidity ?? '--'}%</Text>
                  <Switch value={!!d.isOn} onValueChange={(value) => updateDoc(doc(db, 'devices', d.id), { isOn: value })} />
                </>
              )}
            </View>
          );
        })}
      </ScrollView>
    </AppShell>
  );
}
const styles = StyleSheet.create({
  container: { paddingBottom: 28 },
  card: { backgroundColor: '#1E1E1E', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: palette.border, gap: 8 },
  name: { color: palette.text, fontWeight: '700', fontSize: 17 },
  meta: { color: palette.muted },
  button: { marginTop: 6, backgroundColor: '#1D4ED8', borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 42 },
  buttonText: { color: '#fff', fontWeight: '700' },
});
