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
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { AppShell } from '@/components/app-shell';
import { palette } from '@/components/theme';
import { auth, db, firebaseConfig } from '@/lib/firebase';
import { logoutUser, subscribeToAuthState, User } from '@/lib/auth';

const defaultPrefs = { deviceOfflineAlerts: true, sensorAlerts: true, darkMode: true, units: 'C', language: 'English' };

export default function Settings() {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [devices, setDevices] = useState<{ id: string; name?: string; createdAt?: unknown; credentialToken?: string }[]>([]);
  const [preferences, setPreferences] = useState(defaultPrefs);
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [processingDeviceId, setProcessingDeviceId] = useState<string | null>(null);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [creatingDevice, setCreatingDevice] = useState(false);

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
      const nextDevices = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setDevices(nextDevices);
      if (!selectedDeviceId && nextDevices.length) setSelectedDeviceId(nextDevices[0].id);
      setLoading(false);
    }, () => setLoading(false));

    return () => {
      unsubUser();
      unsubPrefs();
      unsubDevices();
    };
  }, [user?.uid, selectedDeviceId]);

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
      setCreatingDevice(true);
      const deviceRef = doc(collection(db, 'users', user.uid, 'devices'));
      const token = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      await setDoc(deviceRef, {
        name: newDeviceName.trim(),
        ownerUid: user.uid,
        credentialToken: token,
        status: 'offline',
        ledState: false,
        temperature: null,
        lastSeen: null,
        createdAt: serverTimestamp(),
        config: { firmware: 'esp32', protocol: 'firebase' },
        commands: { ledState: false },
        data: { temperature: null, status: 'offline', lastSeen: null },
      });
      setNewDeviceName('');
      setSelectedDeviceId(deviceRef.id);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not add device.');
    } finally {
      setCreatingDevice(false);
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
      if (selectedDeviceId === id) setSelectedDeviceId(null);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not remove device.');
    } finally {
      setProcessingDeviceId(null);
    }
  };

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);

  const copyCredentials = async () => {
    if (!user?.uid || !selectedDevice) return;
    const payload = `deviceId=${selectedDevice.id}\nuid=${user.uid}\napiKey=${firebaseConfig.apiKey}\ndatabasePath=users/${user.uid}/devices/${selectedDevice.id}\ntoken=${selectedDevice.credentialToken ?? ''}`;
    Alert.alert('Device Credentials', payload);
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
        <View style={styles.card}>{/* existing sections kept */}
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

        {/* Add ESP32 Device section hidden for Romers Vendo flow; backend data remains unchanged. */}

        <View style={styles.card}>
          <Text style={styles.heading}>Device Credentials</Text>
          {!selectedDevice ? <Text style={styles.helper}>Add or select a device to provision your ESP32.</Text> : (
            <View style={{ gap: 8 }}>
              <Text style={styles.text}>Device ID: {selectedDevice.id}</Text>
              <Text style={styles.text}>UID Path: users/{user?.uid}/devices/{selectedDevice.id}</Text>
              <Text style={styles.text}>API Key: {firebaseConfig.apiKey}</Text>
              <Text style={styles.text}>Token: {selectedDevice.credentialToken ?? 'Unavailable'}</Text>
              <Pressable style={styles.primaryButtonCompact} onPress={copyCredentials}><Text style={styles.buttonText}>Copy Credentials</Text></Pressable>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Notifications</Text>
          <ToggleRow label="Device offline alerts" value={preferences.deviceOfflineAlerts} onChange={(v) => upsertPreference('deviceOfflineAlerts', v)} />
          <ToggleRow label="Sensor alerts" value={preferences.sensorAlerts} onChange={(v) => upsertPreference('sensorAlerts', v)} />
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Preferences</Text>
          <ToggleRow label="Dark mode (UI only)" value={preferences.darkMode} onChange={(v) => upsertPreference('darkMode', v)} />
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
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: '#333' },
});
