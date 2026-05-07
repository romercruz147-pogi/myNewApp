import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { AppShell } from '@/components/app-shell';
import { palette } from '@/components/theme';
import { subscribeToAuthState, User } from '@/lib/auth';
import { db } from '@/lib/firebase';

type DeviceRecord = Record<string, any> & { id: string };

const lastSeenToMillis = (lastSeen: any) => {
  if (!lastSeen) return 0;
  if (typeof lastSeen.toMillis === 'function') return lastSeen.toMillis();
  if (typeof lastSeen.seconds === 'number') return lastSeen.seconds * 1000;
  if (typeof lastSeen === 'number') return lastSeen;
  return 0;
};

const isDeviceConnected = (device: DeviceRecord) => {
  const heartbeatFresh = Date.now() - lastSeenToMillis(device.lastSeen) < 45000;
  return Boolean(device.isConnected || device.online || device.isOn || heartbeatFresh) && device.connectionStatus !== 'Disconnected';
};

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [devices, setDevices] = useState<DeviceRecord[]>([]);

  useEffect(() => subscribeToAuthState(setUser), []);

  useEffect(() => {
    if (!user?.uid) return;
    const userDevicesRef = collection(db, 'users', user.uid, 'devices');
    const legacyDevicesQuery = query(collection(db, 'devices'), where('uid', '==', user.uid));
    const byId = new Map<string, DeviceRecord>();

    const publish = () => setDevices(Array.from(byId.values()).sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''))));
    const unsubscribeUserDevices = onSnapshot(userDevicesRef, (snap) => {
      snap.docs.forEach((deviceDoc) => byId.set(String(deviceDoc.data().deviceId ?? deviceDoc.id), { id: deviceDoc.id, ...deviceDoc.data() }));
      publish();
    });
    const unsubscribeLegacyDevices = onSnapshot(legacyDevicesQuery, (snap) => {
      snap.docs.forEach((deviceDoc) => {
        const data = deviceDoc.data();
        const key = String(data.deviceId ?? deviceDoc.id);
        if (!byId.has(key)) byId.set(key, { id: deviceDoc.id, ...data });
      });
      publish();
    });

    return () => {
      unsubscribeUserDevices();
      unsubscribeLegacyDevices();
    };
  }, [user?.uid]);

  const connectedCount = useMemo(() => devices.filter(isDeviceConnected).length, [devices]);

  return (
    <AppShell title="Dashboard">
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.subtitle}>Welcome {user?.name ?? 'User'} • {user?.email ?? ''}</Text>
        <View style={styles.row}>
          {[`Devices: ${devices.length}`, `Connected: ${connectedCount}`, `Disconnected: ${Math.max(devices.length - connectedCount, 0)}`].map((text) => (
            <View key={text} style={styles.summaryCard}><Text style={styles.cardText}>{text}</Text></View>
          ))}
        </View>

        <Text style={styles.heading}>ESP32 Devices</Text>
        {devices.length === 0 ? (
          <View style={styles.card}><Text style={styles.meta}>No devices yet. Add an ESP32 device to begin monitoring connection status and usage.</Text></View>
        ) : devices.map((device) => {
          const connected = isDeviceConnected(device);
          return (
            <Pressable
              key={`${device.deviceId ?? device.id}`}
              style={styles.card}
              disabled={!connected}
              onPress={() => router.push({ pathname: '/vendo-control', params: { uid: user?.uid, deviceDocId: device.id, ip: device.ip, token: device.authToken, deviceId: device.deviceId } })}>
              <View style={styles.deviceHeader}>
                <Text style={styles.name}>{device.deviceName ?? device.name ?? 'Romers Vendo'}</Text>
                <Text style={[styles.badge, connected ? styles.connected : styles.disconnected]}>{connected ? 'Connected' : 'Disconnected'}</Text>
              </View>
              <Text style={styles.meta}>Device ID: {device.deviceId ?? device.id}</Text>
              <Text style={styles.meta}>Status: {device.status ?? device.connectionStatus ?? 'Waiting for heartbeat'}</Text>
              <Text style={styles.meta}>Money ₱{device.moneyInserted ?? device.money ?? device.salesToday ?? 0} • Remaining {device.remainingTime ?? 0}s • Usage {device.totalTimeUsed ?? 0}s</Text>
              <Text style={styles.meta}>{connected ? 'Tap to open Device Control / Romers Vendo controls.' : 'Wait for the next heartbeat if the device is still connecting.'}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16, paddingBottom: 28 },
  subtitle: { color: palette.muted },
  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  summaryCard: { backgroundColor: '#1E1E1E', borderRadius: 18, padding: 16, minWidth: 180, borderWidth: 1, borderColor: palette.border },
  cardText: { color: palette.text },
  heading: { color: palette.text, fontWeight: '700', fontSize: 20 },
  card: { backgroundColor: '#1E1E1E', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: palette.border, gap: 8 },
  deviceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  name: { color: palette.text, fontWeight: '700', fontSize: 17, flex: 1 },
  meta: { color: palette.muted, lineHeight: 20 },
  badge: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, fontWeight: '700' },
  connected: { color: '#BBF7D0', backgroundColor: '#14532D' },
  disconnected: { color: '#FECACA', backgroundColor: '#7F1D1D' },
});
