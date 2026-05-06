import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppShell } from '@/components/app-shell';
import { palette } from '@/components/theme';
import { subscribeToAuthState, User } from '@/lib/auth';
import { esp32Api, upsertEsp32Device } from '@/lib/esp32-device-api';

export default function DevicePairing() {
  const [user, setUser] = useState<User | null>(null);
  const [deviceUrl, setDeviceUrl] = useState('192.168.4.1');
  const [deviceId, setDeviceId] = useState('');
  const [deviceToken, setDeviceToken] = useState('');
  const [deviceName, setDeviceName] = useState('Romers Vendo');
  const [loading, setLoading] = useState(false);

  useEffect(() => subscribeToAuthState(setUser), []);

  const readFromEsp32 = async () => {
    try {
      setLoading(true);
      const info = await esp32Api.getPublicDeviceInfo(deviceUrl);
      setDeviceUrl(info.baseUrl);
      setDeviceId(info.deviceId);
      setDeviceToken(info.deviceToken);
      Alert.alert('Device found', `ESP32 ${info.deviceId} is ready to pair.`);
    } catch (error) {
      Alert.alert('Pairing scan failed', error instanceof Error ? error.message : 'Connect to the ESP32 setup hotspot and try again.');
    } finally {
      setLoading(false);
    }
  };

  const pairDevice = async () => {
    if (!user?.uid) {
      Alert.alert('Login required', 'Please sign in before linking a device.');
      return;
    }
    if (!deviceId.trim() || !deviceToken.trim() || !deviceUrl.trim()) {
      Alert.alert('Missing pairing data', 'Enter or scan the ESP32 device ID, token, and IP/domain.');
      return;
    }
    try {
      setLoading(true);
      await upsertEsp32Device(user.uid, {
        name: deviceName.trim() || `Romers Vendo ${deviceId.slice(-6)}`,
        ip: esp32Api.normalizeBaseUrl(deviceUrl),
        deviceId: deviceId.trim(),
        deviceToken: deviceToken.trim(),
        connectionStatus: 'Paired - login required',
        online: false,
      });
      Alert.alert('Device paired', 'The ESP32 is now linked to your account. Open Romers Vendo to authenticate and enable controls.');
    } catch (error) {
      Alert.alert('Pairing failed', error instanceof Error ? error.message : 'Could not save this ESP32 device.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title="Device Pairing">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.heading}>ESP32 Link</Text>
          <Text style={styles.helper}>Connect your phone to the ESP32 hotspot, open 192.168.4.1, select WiFi, then scan or enter the generated device ID and secret token to link this hardware to your account.</Text>
          <TextInput value={deviceUrl} onChangeText={setDeviceUrl} placeholder="ESP32 IP/domain (192.168.4.1)" placeholderTextColor={palette.muted} style={styles.input} autoCapitalize="none" />
          <Pressable style={styles.secondaryButton} onPress={readFromEsp32} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Read Pairing Info from ESP32</Text>}
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Register Device</Text>
          <TextInput value={deviceName} onChangeText={setDeviceName} placeholder="Device name" placeholderTextColor={palette.muted} style={styles.input} />
          <TextInput value={deviceId} onChangeText={setDeviceId} placeholder="Device ID" placeholderTextColor={palette.muted} style={styles.input} autoCapitalize="none" />
          <TextInput value={deviceToken} onChangeText={setDeviceToken} placeholder="Device token / secret" placeholderTextColor={palette.muted} style={styles.input} autoCapitalize="none" secureTextEntry />
          <Pressable style={styles.button} onPress={pairDevice} disabled={loading}>
            <Text style={styles.buttonText}>Pair ESP32 to My Account</Text>
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
  input: { backgroundColor: '#111', borderWidth: 1, borderColor: '#2D2D2D', borderRadius: 12, color: palette.text, paddingHorizontal: 12, paddingVertical: 10 },
  button: { backgroundColor: '#1D4ED8', borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 42 },
  secondaryButton: { backgroundColor: '#334155', borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 42 },
  buttonText: { color: '#fff', fontWeight: '700' },
});
