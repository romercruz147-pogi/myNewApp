import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppShell } from '@/components/app-shell';
import { palette } from '@/components/theme';

type VendoState = {
  moneyInserted: number;
  remainingTime: number;
  totalTimeUsed: number;
  isActive: boolean;
};

const defaultState: VendoState = { moneyInserted: 0, remainingTime: 0, totalTimeUsed: 0, isActive: false };

export default function VendoControl() {
  const { ip, token } = useLocalSearchParams<{ ip?: string; token?: string }>();
  const [state, setState] = useState<VendoState>(defaultState);
  const [timeDelta, setTimeDelta] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchState = useCallback(async () => {
    if (!ip) return;
    try {
      const response = await fetch(`${ip}/vendo/state`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error('Failed to fetch latest vendo state.');
      const data = await response.json();
      setState({
        moneyInserted: Number(data?.moneyInserted ?? 0),
        remainingTime: Number(data?.remainingTime ?? 0),
        totalTimeUsed: Number(data?.totalTimeUsed ?? 0),
        isActive: Boolean(data?.isActive),
      });
    } catch (error) {
      Alert.alert('Connection issue', error instanceof Error ? error.message : 'ESP32 is offline or unreachable.');
    } finally {
      setLoading(false);
    }
  }, [ip, token]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, [fetchState]);

  const resetMoney = async () => {
    if (!ip) return;
    try {
      setSubmitting(true);
      const response = await fetch(`${ip}/vendo/reset-money`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!response.ok) throw new Error('Could not reset money on ESP32.');
      await fetchState();
    } catch (error) {
      Alert.alert('Request failed', error instanceof Error ? error.message : 'Failed to send reset command.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateTime = async () => {
    if (!ip) return;
    const delta = Number(timeDelta);
    if (Number.isNaN(delta)) {
      Alert.alert('Invalid value', 'Enter a number of seconds or minutes based on your firmware setting.');
      return;
    }
    try {
      setSubmitting(true);
      const response = await fetch(`${ip}/vendo/update-time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ delta }),
      });
      if (!response.ok) throw new Error('Could not update time on ESP32.');
      setTimeDelta('');
      await fetchState();
    } catch (error) {
      Alert.alert('Request failed', error instanceof Error ? error.message : 'Failed to update time.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell title="Vendo Control">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.heading}>Session Status</Text>
          <Text style={styles.text}>Device IP: {ip ?? 'N/A'}</Text>
          <Text style={styles.text}>Money Inserted: {state.moneyInserted}</Text>
          <Text style={styles.text}>Remaining Time: {state.remainingTime}</Text>
          <Text style={styles.text}>Total Time Used: {state.totalTimeUsed}</Text>
          <Text style={[styles.status, state.isActive ? styles.active : styles.inactive]}>
            {state.isActive ? 'Session Active / Open' : 'Session Inactive / Closed'}
          </Text>
          {loading && <ActivityIndicator color={palette.accent} />}
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Controls</Text>
          <Pressable style={styles.button} onPress={resetMoney} disabled={submitting}>
            <Text style={styles.buttonText}>{submitting ? 'Sending...' : 'Reset Money'}</Text>
          </Pressable>
          <TextInput
            value={timeDelta}
            onChangeText={setTimeDelta}
            placeholder="Add/Subtract time (e.g., 60 or -60)"
            placeholderTextColor={palette.muted}
            style={styles.input}
            keyboardType="numbers-and-punctuation"
          />
          <Pressable style={styles.button} onPress={updateTime} disabled={submitting}>
            <Text style={styles.buttonText}>{submitting ? 'Sending...' : 'Update Time'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, paddingBottom: 28 },
  card: { backgroundColor: '#1E1E1E', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: palette.border, gap: 10 },
  heading: { color: palette.text, fontWeight: '700', fontSize: 18 },
  text: { color: palette.text },
  status: { fontWeight: '700' },
  active: { color: '#60A5FA' },
  inactive: { color: '#FCA5A5' },
  input: { backgroundColor: '#111', borderWidth: 1, borderColor: '#2D2D2D', borderRadius: 12, color: palette.text, paddingHorizontal: 12, paddingVertical: 10 },
  button: { backgroundColor: '#1D4ED8', borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 42 },
  buttonText: { color: '#fff', fontWeight: '700' },
});
