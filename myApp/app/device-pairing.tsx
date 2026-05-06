import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppShell } from '@/components/app-shell';
import { palette } from '@/components/theme';
import { subscribeToAuthState, User } from '@/lib/auth';
import { createPairedDeviceProfile, esp32Api, generateDeviceCredentials, updatePairedDevice } from '@/lib/esp32-device-api';

export default function DevicePairing() {
  const [user, setUser] = useState<User | null>(null);
  const [deviceUrl, setDeviceUrl] = useState('192.168.4.1');
  const [backendUrl, setBackendUrl] = useState(process.env.EXPO_PUBLIC_DEVICE_HEARTBEAT_URL ?? '');
  const [deviceId, setDeviceId] = useState('');
  const [deviceToken, setDeviceToken] = useState('');
  const [deviceName, setDeviceName] = useState('Romers Vendo');
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => subscribeToAuthState(setUser), []);

  const credentialText = useMemo(
    () => `Romers Vendo pairing credentials\nDevice ID: ${deviceId || 'Not generated yet'}\nPasskey / Token: ${deviceToken || 'Not generated yet'}${backendUrl ? `\nBackend URL: ${backendUrl}` : ''}`,
    [backendUrl, deviceId, deviceToken],
  );

  const generateProfile = async () => {
    if (!user?.uid) {
      Alert.alert('Login required', 'Please sign in before generating a device profile.');
      return;
    }

    try {
      setLoading(true);
      const credentials = generateDeviceCredentials();
      const profile = await createPairedDeviceProfile(user.uid, deviceName, credentials, { ip: deviceUrl, backendUrl });
      setDeviceId(profile.deviceId);
      setDeviceToken(profile.deviceToken);
      setGenerated(true);
      Alert.alert('Device profile created', 'Copy these app-generated credentials into the ESP32 setup portal or push them directly while connected to the ESP32 hotspot.');
    } catch (error) {
      Alert.alert('Profile creation failed', error instanceof Error ? error.message : 'Could not save this device profile.');
    } finally {
      setLoading(false);
    }
  };

  const shareCredentials = async () => {
    if (!deviceId || !deviceToken) {
      Alert.alert('Generate first', 'Create a device profile before sharing credentials.');
      return;
    }
    await Share.share({ title: 'Romers Vendo Pairing Credentials', message: credentialText });
  };

  const readFromEsp32 = async () => {
    try {
      setLoading(true);
      const info = await esp32Api.getPublicDeviceInfo(deviceUrl);
      setDeviceUrl(info.baseUrl);
      Alert.alert('ESP32 found', `ESP32 setup portal is reachable at ${info.baseUrl}. Use Configure ESP32 to install the app-generated ID and passkey.`);
    } catch (error) {
      Alert.alert('Pairing scan failed', error instanceof Error ? error.message : 'Connect to the ESP32 setup hotspot and try again.');
    } finally {
      setLoading(false);
    }
  };

  const configureEsp32 = async () => {
    if (!user?.uid) {
      Alert.alert('Login required', 'Please sign in before configuring a device.');
      return;
    }
    if (!deviceId.trim() || !deviceToken.trim() || !deviceUrl.trim()) {
      Alert.alert('Missing pairing data', 'Generate a device profile and enter the ESP32 IP/domain.');
      return;
    }
    try {
      setLoading(true);
      const info = await esp32Api.configurePairing(deviceUrl, deviceId.trim(), deviceToken.trim(), backendUrl.trim() || undefined, user.uid);
      const ip = String(info?.ip ?? deviceUrl);
      await updatePairedDevice(user.uid, deviceId.trim(), {
        ip: esp32Api.normalizeBaseUrl(ip),
        backendUrl: backendUrl.trim(),
        ownerUid: user.uid,
        status: 'Configured on ESP32',
        connectionStatus: 'Waiting for heartbeat',
        isConnected: false,
        online: false,
      });
      Alert.alert('ESP32 configured', 'The firmware now stores the app-generated Device ID and passkey. It will report connected once heartbeat updates arrive.');
    } catch (error) {
      Alert.alert('ESP32 configuration failed', error instanceof Error ? error.message : 'Paste the credentials into the ESP32 setup portal manually and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title="Device Pairing">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.heading}>Create Blynk-style Device Profile</Text>
          <Text style={styles.helper}>The app generates the Device ID and secure passkey, stores them under your Firebase account, and lets the ESP32 authenticate with those exact credentials.</Text>
          <TextInput value={deviceName} onChangeText={setDeviceName} placeholder="Device name" placeholderTextColor={palette.muted} style={styles.input} />
          <TextInput value={deviceUrl} onChangeText={setDeviceUrl} placeholder="ESP32 IP/domain (192.168.4.1)" placeholderTextColor={palette.muted} style={styles.input} autoCapitalize="none" />
          <TextInput value={backendUrl} onChangeText={setBackendUrl} placeholder="Optional heartbeat backend URL" placeholderTextColor={palette.muted} style={styles.input} autoCapitalize="none" />
          <Pressable style={styles.button} onPress={generateProfile} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{generated ? 'Generate Another Device Profile' : 'Generate Device ID + Passkey'}</Text>}
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Generated Credentials</Text>
          <View style={styles.credentialBox}>
            <Text style={styles.label}>Device ID</Text>
            <Text selectable style={styles.credential}>{deviceId || 'Tap Generate Device ID + Passkey'}</Text>
          </View>
          <View style={styles.credentialBox}>
            <Text style={styles.label}>Passkey / Device Token</Text>
            <Text selectable style={styles.credential}>{deviceToken || 'Secure token will appear here'}</Text>
          </View>
          <Pressable style={styles.secondaryButton} onPress={shareCredentials} disabled={!deviceId || !deviceToken}>
            <Text style={styles.buttonText}>Copy / Share Credentials</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Install Credentials on ESP32</Text>
          <Text style={styles.helper}>Connect your phone to the Romers-Vendo-Setup hotspot, open 192.168.4.1, and paste the Device ID and passkey into the setup portal. You can also push the credentials directly from here.</Text>
          <Pressable style={styles.secondaryButton} onPress={readFromEsp32} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Check ESP32 Setup Portal</Text>}
          </Pressable>
          <Pressable style={styles.button} onPress={configureEsp32} disabled={loading || !deviceId || !deviceToken}>
            <Text style={styles.buttonText}>Configure ESP32 with App Credentials</Text>
          </Pressable>
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, paddingBottom: 28 },
  card: { backgroundColor: '#1E1E1E', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: palette.border, gap: 10 },
  heading: { color: palette.text, fontWeight: '700', fontSize: 20 },
  helper: { color: palette.muted, lineHeight: 20 },
  label: { color: palette.muted, fontWeight: '700', textTransform: 'uppercase', fontSize: 12 },
  credentialBox: { backgroundColor: '#111', borderWidth: 1, borderColor: '#2D2D2D', borderRadius: 12, padding: 12, gap: 6 },
  credential: { color: palette.text, fontWeight: '700' },
  input: { backgroundColor: '#111', borderWidth: 1, borderColor: '#2D2D2D', borderRadius: 12, color: palette.text, paddingHorizontal: 12, paddingVertical: 10 },
  button: { backgroundColor: '#1D4ED8', borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 42 },
  secondaryButton: { backgroundColor: '#334155', borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 42 },
  buttonText: { color: '#fff', fontWeight: '700' },
});
