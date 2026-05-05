import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential, updateProfile } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { AppShell } from '@/components/app-shell';
import { palette } from '@/components/theme';
import { auth, db } from '@/lib/firebase';
import { logoutUser, subscribeToAuthState, User } from '@/lib/auth';

const defaultPrefs = { deviceOfflineAlerts: true, sensorAlerts: true, darkMode: true, units: 'C', language: 'English' };

export default function Settings() {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [devices, setDevices] = useState<{ id: string; name?: string; createdAt?: unknown }[]>([]);
  const [preferences, setPreferences] = useState(defaultPrefs);
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [processingDeviceId, setProcessingDeviceId] = useState<string | null>(null);
  const [newDeviceName, setNewDeviceName] = useState('');

  useEffect(() => subscribeToAuthState((authUser) => {
    setUser(authUser);
    setDisplayName(authUser?.name ?? '');
  }), []);

  useEffect(() => {
    if (!user?.uid) return;

    const userDocRef = doc(db, 'users', user.uid);
    const prefsRef = doc(db, 'users', user.uid, 'settings', 'preferences');
    const devicesRef = collection(db, 'users', user.uid, 'devices');

    const unsubUser = onSnapshot(userDocRef, (snap) => {
      const data = snap.data();
      if (data?.name) setDisplayName(data.name);
    });

    const unsubPrefs = onSnapshot(prefsRef, (snap) => {
      if (snap.exists()) {
        setPreferences({ ...defaultPrefs, ...snap.data() });
      } else {
        setDoc(prefsRef, defaultPrefs, { merge: true }).catch(() => {});
      }
    });

    const unsubDevices = onSnapshot(devicesRef, (snap) => {
      setDevices(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));

    return () => {
      unsubUser();
      unsubPrefs();
      unsubDevices();
    };
  }, [user?.uid]);

  const isGoogleUser = useMemo(
    () => !!auth.currentUser?.providerData.some((provider) => provider.providerId === 'google.com'),
    [],
  );

  const saveDisplayName = async () => {
    if (!user?.uid || !displayName.trim()) return;
    try {
      setSavingName(true);
      await updateDoc(doc(db, 'users', user.uid), { name: displayName.trim() });
      if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: displayName.trim() });
      Alert.alert('Saved', 'Display name updated.');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not update name.');
    } finally {
      setSavingName(false);
    }
  };

  const upsertPreference = async (key: string, value: string | boolean) => {
    if (!user?.uid) return;
    try {
      await setDoc(doc(db, 'users', user.uid, 'settings', 'preferences'), { [key]: value }, { merge: true });
      setPreferences((prev) => ({ ...prev, [key]: value }));
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not save preference.');
    }
  };

  const addDevice = async () => {
    if (!user?.uid || !newDeviceName.trim()) return;
    try {
      await addDoc(collection(db, 'users', user.uid, 'devices'), {
        name: newDeviceName.trim(),
        createdAt: serverTimestamp(),
      });
      setNewDeviceName('');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not add device.');
    }
  };

  const renameDevice = async (id: string, currentName: string) => {
    Alert.prompt('Rename device', 'Enter a new device name', async (value) => {
      const name = value?.trim();
      if (!user?.uid || !name || name === currentName) return;
      try {
        setProcessingDeviceId(id);
        await updateDoc(doc(db, 'users', user.uid, 'devices', id), { name });
      } catch (error) {
        Alert.alert('Error', error instanceof Error ? error.message : 'Could not rename device.');
      } finally {
        setProcessingDeviceId(null);
      }
    });
  };

  const removeDevice = async (id: string) => {
    if (!user?.uid) return;
    try {
      setProcessingDeviceId(id);
      await deleteDoc(doc(db, 'users', user.uid, 'devices', id));
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not remove device.');
    } finally {
      setProcessingDeviceId(null);
    }
  };

  const deleteCurrentAccount = async () => {
    if (!auth.currentUser) return;
    try {
      if (!isGoogleUser) {
        Alert.prompt('Re-authentication required', 'Enter your password to delete account', async (password) => {
          if (!password || !auth.currentUser?.email) return;
          const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
          await reauthenticateWithCredential(auth.currentUser, credential);
          await deleteUser(auth.currentUser);
          Alert.alert('Deleted', 'Account deleted successfully.');
        }, 'secure-text');
        return;
      }
      await deleteUser(auth.currentUser);
      Alert.alert('Deleted', 'Account deleted successfully.');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not delete account.');
    }
  };

  return (
    <AppShell title="Settings">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.heading}>Account</Text>
          {!!user?.photoURL && <Image source={{ uri: user.photoURL }} style={styles.avatar} />}
          <Text style={styles.label}>Display Name</Text>
          <TextInput value={displayName} onChangeText={setDisplayName} style={styles.input} placeholderTextColor={palette.muted} />
          <Pressable style={styles.primaryButton} onPress={saveDisplayName}>
            {savingName ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save Name</Text>}
          </Pressable>
          <Text style={styles.label}>Email</Text>
          <TextInput editable={false} value={user?.email ?? ''} style={[styles.input, styles.readOnly]} />
          {isGoogleUser && <Text style={styles.helper}>Email is read-only for Google accounts.</Text>}
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Security</Text>
          <Pressable style={styles.secondaryButton} onPress={logoutUser}><Text style={styles.buttonText}>Logout</Text></Pressable>
          <Pressable style={styles.dangerButton} onPress={deleteCurrentAccount}><Text style={styles.buttonText}>Delete Account</Text></Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Devices</Text>
          <View style={styles.row}>
            <TextInput value={newDeviceName} onChangeText={setNewDeviceName} placeholder="Add ESP32 device" placeholderTextColor={palette.muted} style={[styles.input, styles.flex]} />
            <Pressable style={styles.primaryButtonCompact} onPress={addDevice}><Text style={styles.buttonText}>Add</Text></Pressable>
          </View>
          {loading ? <ActivityIndicator color={palette.accent} /> : devices.map((device) => (
            <View key={device.id} style={styles.listItem}>
              <Text style={styles.text}>{device.name || 'Unnamed device'}</Text>
              <View style={styles.row}>
                <Pressable onPress={() => renameDevice(device.id, device.name || '')}><Text style={styles.link}>Rename</Text></Pressable>
                <Pressable onPress={() => removeDevice(device.id)}><Text style={styles.dangerText}>{processingDeviceId === device.id ? '...' : 'Remove'}</Text></Pressable>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Notifications</Text>
          <ToggleRow label="Device offline alerts" value={preferences.deviceOfflineAlerts} onChange={(v) => upsertPreference('deviceOfflineAlerts', v)} />
          <ToggleRow label="Sensor alerts" value={preferences.sensorAlerts} onChange={(v) => upsertPreference('sensorAlerts', v)} />
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Preferences</Text>
          <ToggleRow label="Dark mode (UI only)" value={preferences.darkMode} onChange={(v) => upsertPreference('darkMode', v)} />
          <SegmentedChoice label="Units" values={['C', 'F']} active={preferences.units} onSelect={(v) => upsertPreference('units', v)} />
          <SegmentedChoice label="Language" values={['English', 'Spanish']} active={preferences.language} onSelect={(v) => upsertPreference('language', v)} />
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>About / Help</Text>
          <Text style={styles.text}>Version: 1.0.0</Text>
          <Text style={styles.text}>Support: support@iotapp.dev</Text>
        </View>
      </ScrollView>
    </AppShell>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.text}>{label}</Text>
      <Switch value={value} onValueChange={onChange} thumbColor="#fff" trackColor={{ false: '#333', true: '#2563EB' }} />
    </View>
  );
}

function SegmentedChoice({ label, values, active, onSelect }: { label: string; values: string[]; active: string; onSelect: (value: string) => void }) {
  return (
    <View>
      <Text style={[styles.label, { marginTop: 0 }]}>{label}</Text>
      <View style={styles.segmentWrap}>
        {values.map((value) => (
          <Pressable key={value} onPress={() => onSelect(value)} style={[styles.segmentButton, active === value && styles.segmentButtonActive]}>
            <Text style={[styles.text, active === value && styles.segmentTextActive]}>{value === 'C' ? '°C' : value === 'F' ? '°F' : value}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, paddingBottom: 28 },
  card: { backgroundColor: '#1E1E1E', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: palette.border, gap: 10 },
  heading: { color: palette.text, fontWeight: '700', fontSize: 18 },
  label: { color: '#C7C7C7', marginTop: 6 },
  text: { color: palette.text },
  helper: { color: palette.muted, fontSize: 12 },
  input: { backgroundColor: '#111', borderWidth: 1, borderColor: '#2D2D2D', borderRadius: 12, color: palette.text, paddingHorizontal: 12, paddingVertical: 10 },
  readOnly: { opacity: 0.8 },
  primaryButton: { backgroundColor: '#1D4ED8', borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 42 },
  primaryButtonCompact: { backgroundColor: '#1D4ED8', borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 42, paddingHorizontal: 14 },
  secondaryButton: { backgroundColor: '#374151', borderRadius: 12, alignItems: 'center', padding: 12 },
  dangerButton: { backgroundColor: '#991B1B', borderRadius: 12, alignItems: 'center', padding: 12 },
  buttonText: { color: '#fff', fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  listItem: { backgroundColor: '#121212', borderWidth: 1, borderColor: '#2B2B2B', borderRadius: 12, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: '#60A5FA', marginRight: 12 },
  dangerText: { color: '#FCA5A5' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  segmentWrap: { flexDirection: 'row', gap: 8 },
  segmentButton: { borderRadius: 10, borderWidth: 1, borderColor: '#303030', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#151515' },
  segmentButtonActive: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  segmentTextActive: { fontWeight: '700' },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: '#333' },
});
