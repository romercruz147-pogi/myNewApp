import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppShell } from '@/components/app-shell';
import { palette } from '@/components/theme';
import { subscribeToAuthState, User } from '@/lib/auth';
import { esp32Api, upsertEsp32Device } from '@/lib/esp32-device-api';

export default function RomersVendoLogin() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ipAddress, setIpAddress] = useState('');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => subscribeToAuthState(setUser), []);

  const loginToEsp32 = async () => {
    if (!ipAddress.trim() || !username.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter ESP32 IP/domain, username, and password.');
      return;
    }

    try {
      setLoading(true);
      const auth = await esp32Api.authenticate(ipAddress, username, password);
      const status = await esp32Api.getStatus(auth.baseUrl, auth.token);
      const deviceId = status.deviceId || auth.deviceId || `manual-${auth.baseUrl.replace(/\W/g, '-')}`;
      const deviceSecret = status.deviceSecret || auth.deviceSecret;

      if (user?.uid) {
        await upsertEsp32Device(user.uid, {
          ip: auth.baseUrl,
          username: username.trim(),
          authToken: auth.token,
          deviceId,
          deviceSecret,
          name: `Romers Vendo ${deviceId.slice(-6)}`,
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
        params: { ip: auth.baseUrl, username: username.trim(), token: auth.token, deviceId, deviceSecret },
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
        <Text style={styles.heading}>ESP32 Secure Login</Text>
        <Text style={styles.helper}>Enter the ESP32 local IP/domain and local device account before opening controls. Successful logins are added to Devices automatically.</Text>
        <TextInput
          value={ipAddress}
          onChangeText={setIpAddress}
          placeholder="ESP32 IP/domain (e.g., 192.168.1.50)"
          placeholderTextColor={palette.muted}
          style={styles.input}
          autoCapitalize="none"
        />
        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder="ESP32 username"
          placeholderTextColor={palette.muted}
          style={styles.input}
          autoCapitalize="none"
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="ESP32 password"
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
