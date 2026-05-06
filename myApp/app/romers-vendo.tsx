import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppShell } from '@/components/app-shell';
import { palette } from '@/components/theme';

export default function RomersVendoLogin() {
  const router = useRouter();
  const [ipAddress, setIpAddress] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const loginToEsp32 = async () => {
    if (!ipAddress.trim() || !username.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter ESP32 IP, username, and password.');
      return;
    }

    const baseUrl = ipAddress.trim().startsWith('http') ? ipAddress.trim() : `http://${ipAddress.trim()}`;

    try {
      setLoading(true);
      const response = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      if (!response.ok) {
        throw new Error('Invalid ESP32 credentials or login endpoint unavailable.');
      }

      const data = await response.json().catch(() => ({}));
      const token = typeof data?.token === 'string' ? data.token : '';

      router.push({
        pathname: '/vendo-control',
        params: { ip: baseUrl, username: username.trim(), token },
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
        <Text style={styles.heading}>ESP32 Login</Text>
        <Text style={styles.helper}>Connect to your local ESP32 vendo controller.</Text>
        <TextInput
          value={ipAddress}
          onChangeText={setIpAddress}
          placeholder="ESP32 IP (e.g., 192.168.1.50)"
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
        <Pressable style={styles.button} onPress={loginToEsp32}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Login to Device</Text>}
        </Pressable>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#1E1E1E', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: palette.border, gap: 10 },
  heading: { color: palette.text, fontWeight: '700', fontSize: 20 },
  helper: { color: palette.muted, marginBottom: 6 },
  input: { backgroundColor: '#111', borderWidth: 1, borderColor: '#2D2D2D', borderRadius: 12, color: palette.text, paddingHorizontal: 12, paddingVertical: 10 },
  button: { marginTop: 6, backgroundColor: '#1D4ED8', borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 42 },
  buttonText: { color: '#fff', fontWeight: '700' },
});
