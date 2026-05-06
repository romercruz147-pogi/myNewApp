import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppShell } from '@/components/app-shell';
import { palette } from '@/components/theme';
import { subscribeToAuthState, User } from '@/lib/auth';
import {
  DEFAULT_DEVICE_BACKEND_URL,
  createDeviceConnectionProfile,
  esp32Api,
  generateDeviceCredentials,
  normalizeBackendUrl,
  updateConnectedDevice,
  validateAndConnectDevice,
} from '@/lib/esp32-device-api';

export default function SecureConnection() {
  const [user, setUser] = useState<User | null>(null);
  const [deviceUrl, setDeviceUrl] = useState('192.168.4.1');
  const [backendUrl, setBackendUrl] = useState(DEFAULT_DEVICE_BACKEND_URL);
  const [deviceId, setDeviceId] = useState('');
  const [deviceSecret, setDeviceSecret] = useState('');
  const [deviceName, setDeviceName] = useState('Romers Vendo');
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => subscribeToAuthState(setUser), []);

  const cleanBackendUrl = normalizeBackendUrl(backendUrl);
  const credentialText = useMemo(
    () => `Romers Vendo device credentials\nDevice ID: ${deviceId || 'Not generated yet'}\ndeviceSecret: ${deviceSecret || 'Not generated yet'}${cleanBackendUrl ? `\nBackend URL: ${cleanBackendUrl}` : ''}`,
    [cleanBackendUrl, deviceId, deviceSecret],
  );

  const generateProfile = async () => {
    if (!user?.uid) {
      Alert.alert('Login required', 'Please sign in before generating device credentials.');
      return;
    }

    try {
      setLoading(true);
      const credentials = generateDeviceCredentials();
      const profile = await createDeviceConnectionProfile(user.uid, deviceName, credentials, { ip: deviceUrl, backendUrl: cleanBackendUrl });
      setDeviceId(profile.deviceId);
      setDeviceSecret(profile.deviceSecret ?? '');
      setGenerated(true);
      Alert.alert('Device credentials created', 'Copy this Device ID and deviceSecret into the ESP32 setup portal. The device will appear connected as soon as heartbeat updates arrive.');
    } catch (error) {
      Alert.alert('Credential creation failed', error instanceof Error ? error.message : 'Could not save these device credentials.');
    } finally {
      setLoading(false);
    }
  };

  const connectExistingCredentials = async () => {
    if (!user?.uid) {
      Alert.alert('Login required', 'Please sign in before connecting a device.');
      return;
    }
    try {
      setLoading(true);
      const profile = await validateAndConnectDevice(user.uid, deviceId, deviceSecret, { deviceName, backendUrl: cleanBackendUrl });
      setDeviceId(profile.deviceId);
      setDeviceSecret(profile.deviceSecret ?? '');
      Alert.alert('Device connected', 'Credentials were validated. The device is now shown on Dashboard and Device Control, with live status driven by ESP32 heartbeat data.');
    } catch (error) {
      Alert.alert('Validation failed', error instanceof Error ? error.message : 'The Device ID or deviceSecret is invalid.');
    } finally {
      setLoading(false);
    }
  };

  const shareCredentials = async () => {
    if (!deviceId || !deviceSecret) {
      Alert.alert('Generate first', 'Create or validate device credentials before sharing them.');
      return;
    }
    await Share.share({ title: 'Romers Vendo Device Credentials', message: credentialText });
  };

  const readFromEsp32 = async () => {
    try {
      setLoading(true);
      const info = await esp32Api.getPublicDeviceInfo(deviceUrl);
      setDeviceUrl(info.baseUrl);
      setDeviceId(info.deviceId || deviceId);
      setDeviceSecret(info.deviceSecret || deviceSecret);
      Alert.alert('ESP32 found', `ESP32 setup portal is reachable at ${info.baseUrl}. Paste or push the Device ID and deviceSecret to finish the secure connection.`);
    } catch (error) {
      Alert.alert('ESP32 check failed', error instanceof Error ? error.message : 'Connect to the ESP32 setup hotspot and try again.');
    } finally {
      setLoading(false);
    }
  };

  const configureEsp32 = async () => {
    if (!user?.uid) {
      Alert.alert('Login required', 'Please sign in before configuring a device.');
      return;
    }
    if (!deviceId.trim() || !deviceSecret.trim() || !deviceUrl.trim()) {
      Alert.alert('Missing credentials', 'Enter a Device ID, deviceSecret, and ESP32 IP/domain.');
      return;
    }
    try {
      setLoading(true);
      const info = await esp32Api.configureDeviceCredentials(deviceUrl, deviceId.trim(), deviceSecret.trim(), cleanBackendUrl || undefined, user.uid);
      const ip = String(info?.ip ?? deviceUrl);
      await updateConnectedDevice(user.uid, deviceId.trim(), {
        ip: esp32Api.normalizeBaseUrl(ip),
        backendUrl: cleanBackendUrl,
        ownerUid: user.uid,
        status: 'Credentials saved on ESP32',
        connectionStatus: 'Waiting for heartbeat',
        isConnected: false,
        online: false,
      });
      Alert.alert('ESP32 configured', 'The firmware now securely stores the Device ID and deviceSecret. It will report connected once heartbeat updates arrive.');
    } catch (error) {
      Alert.alert('ESP32 configuration failed', error instanceof Error ? error.message : 'Paste the credentials into the ESP32 setup portal manually and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title="Secure Connection">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.heading}>Create Device Credentials</Text>
          <Text style={styles.helper}>The app creates a unique Device ID and deviceSecret, stores them in Firebase, and the ESP32 authenticates with the same values after you enter them in the setup portal.</Text>
          <TextInput value={deviceName} onChangeText={setDeviceName} placeholder="Device name" placeholderTextColor={palette.muted} style={styles.input} />
          <TextInput value={deviceUrl} onChangeText={setDeviceUrl} placeholder="ESP32 IP/domain (192.168.4.1)" placeholderTextColor={palette.muted} style={styles.input} autoCapitalize="none" />
          <TextInput value={backendUrl} onChangeText={setBackendUrl} placeholder="Backend URL for ESP32 heartbeat" placeholderTextColor={palette.muted} style={styles.input} autoCapitalize="none" />
          <Pressable style={styles.button} onPress={generateProfile} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{generated ? 'Generate Another Device' : 'Generate Device ID + deviceSecret'}</Text>}
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Connect Existing Device</Text>
          <Text style={styles.helper}>Enter a Device ID and deviceSecret that already exist in the backend. Valid credentials immediately connect the device to your account.</Text>
          <TextInput value={deviceId} onChangeText={setDeviceId} placeholder="Device ID" placeholderTextColor={palette.muted} style={styles.input} autoCapitalize="none" />
          <TextInput value={deviceSecret} onChangeText={setDeviceSecret} placeholder="deviceSecret" placeholderTextColor={palette.muted} style={styles.input} autoCapitalize="none" secureTextEntry />
          <Pressable style={styles.secondaryButton} onPress={connectExistingCredentials} disabled={loading || !deviceId || !deviceSecret}>
            <Text style={styles.buttonText}>Validate & Connect Device</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Generated Credentials</Text>
          <View style={styles.credentialBox}>
            <Text style={styles.label}>Device ID</Text>
            <Text selectable style={styles.credential}>{deviceId || 'Tap Generate Device ID + deviceSecret'}</Text>
          </View>
          <View style={styles.credentialBox}>
            <Text style={styles.label}>deviceSecret</Text>
            <Text selectable style={styles.credential}>{deviceSecret || 'Secure deviceSecret will appear here'}</Text>
          </View>
          <Pressable style={styles.secondaryButton} onPress={shareCredentials} disabled={!deviceId || !deviceSecret}>
            <Text style={styles.buttonText}>Copy / Share Credentials</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Save Credentials on ESP32</Text>
          <Text style={styles.helper}>Connect your phone to the Romers-Vendo-Setup hotspot, open 192.168.4.1, and paste the Device ID and deviceSecret into the setup portal. You can also push the credentials directly from here.</Text>
          <Pressable style={styles.secondaryButton} onPress={readFromEsp32} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Check ESP32 Setup Portal</Text>}
          </Pressable>
          <Pressable style={styles.button} onPress={configureEsp32} disabled={loading || !deviceId || !deviceSecret}>
            <Text style={styles.buttonText}>Save Credentials to ESP32</Text>
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
