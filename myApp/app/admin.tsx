import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { AppShell } from '@/components/app-shell';
import { palette } from '@/components/theme';
import { subscribeToAuthState, User } from '@/lib/auth';
import { db } from '@/lib/firebase';

export default function AdminScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => subscribeToAuthState(setUser), []);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubMe = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      setIsAdmin(snap.data()?.role === 'admin');
      setLoading(false);
    });
    return unsubMe;
  }, [user?.uid]);

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [isAdmin]);

  const title = isAdmin ? 'Admin' : 'Admin (Restricted)';

  return (
    <AppShell title={title}>
      {loading ? <ActivityIndicator color={palette.accent} /> : !isAdmin ? (
        <View style={styles.card}><Text style={styles.text}>This page is private. Your account is not an admin.</Text></View>
      ) : (
        <View style={{ gap: 12 }}>
          {users.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.name}>{item.name || 'Unknown'}</Text>
              <Text style={styles.text}>{item.email || 'No email'}</Text>
              <Text style={styles.meta}>Provider: {item.provider || 'unknown'} • Role: {item.role || 'user'}</Text>
            </View>
          ))}
        </View>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#1E1E1E', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: palette.border },
  name: { color: palette.text, fontWeight: '700', fontSize: 16 },
  text: { color: palette.text, marginTop: 6 },
  meta: { color: palette.muted, marginTop: 6 },
});
