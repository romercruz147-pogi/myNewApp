import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppShell } from '@/components/app-shell';
import { palette } from '@/components/theme';
import { subscribeToAuthState, User } from '@/lib/auth';
import { esp32Api, upsertEsp32Device } from '@/lib/esp32-device-api';
import { iotBackendApi } from '@/lib/iot-backend-api';

export default function RomersVendoLogin() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ipAddress, setIpAddress] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [deviceSecret, setDeviceSecret] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => subscribeToAuthState(setUser), []);

  const loginToEsp32 = async () => {
    if (!ipAddress.trim() || !deviceId.trim() || !deviceSecret.trim()) {
      Alert.alert('Missing fields', 'Please enter ESP32 IP/domain, Device ID, and Device Secret.');
      return;
    }

    try {
      setLoading(true);
      await iotBackendApi.authenticateDevice(deviceId.trim(), deviceSecret.trim());
      const status = await esp32Api.getStatus(ipAddress, deviceSecret.trim());
      const resolvedDeviceId = status.deviceId || deviceId.trim();

      if (user?.uid) {
        await upsertEsp32Device(user.uid, {
          ip: ipAddress.trim(),
          username: 'device-auth',
          authToken: deviceSecret.trim(),
          deviceId: resolvedDeviceId,
          deviceSecret: deviceSecret.trim(),
          name: `Romers Vendo ${resolvedDeviceId.slice(-6)}`,
          remainingTime: Number(status.remainingTime ?? 0),
          totalTimeUsed: Number(status.totalTimeUsed ?? status.totalTime ?? 0),
          salesToday: Number(status.salesToday ?? status.money ?? 0),
          totalEarnings: Number(status.totalEarnings ?? 0),
          minCreditsToStart: Number(status.minCreditsToStart ?? 50),
          secondsForMinCredits: Number(status.secondsForMinCredits ?? 3000),
        });
      }

      router.push({
        pathname: '/vendo-control',
        params: { ip: ipAddress.trim(), username: 'device-auth', token: deviceSecret.trim(), deviceId: resolvedDeviceId, deviceSecret: deviceSecret.trim() },
      });
    } catch (error) {
      Alert.alert('Connection failed', error instanceof Error ? error.message : 'Could not connect to ESP32 device.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title="Romers Vendo">
      <View style={styles.card}>
        <Text style={styles.heading}>ESP32 Device Authentication</Text>
        <Text style={styles.helper}>Use Device ID + Device Secret only. Pairing credentials are no longer used.</Text>
        <TextInput
          value={ipAddress}
          onChangeText={setIpAddress}
          placeholder="ESP32 IP/domain (e.g., 192.168.1.50)"
          placeholderTextColor={palette.muted}
          style={styles.input}
          autoCapitalize="none"
        />
        <TextInput
          value={deviceId}
          onChangeText={setDeviceId}
          placeholder="Device ID"
          placeholderTextColor={palette.muted}
          style={styles.input}
          autoCapitalize="none"
        />
        <TextInput
          value={deviceSecret}
          onChangeText={setDeviceSecret}
          placeholder="Device Secret"
          placeholderTextColor={palette.muted}
          style={styles.input}
          secureTextEntry
        />
        <Pressable style={styles.button} onPress={loginToEsp32} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Authenticate & Link Device</Text>}
        </Pressable>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#1E1E1E', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: palette.border, gap: 10 },
  heading: { color: palette.text, fontWeight: '700', fontSize: 20 },
  helper: { color: palette.muted, marginBottom: 6, lineHeight: 20 },
  input: { backgroundColor: '#111', borderWidth: 1, borderColor: '#2D2D2D', borderRadius: 12, color: palette.text, paddingHorizontal: 12, paddingVertical: 10 },
  button: { marginTop: 6, backgroundColor: '#1D4ED8', borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 42 },
  buttonText: { color: '#fff', fontWeight: '700' },
});
