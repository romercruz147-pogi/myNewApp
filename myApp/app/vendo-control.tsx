import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppShell } from '@/components/app-shell';
import { palette } from '@/components/theme';
import { esp32Api } from '@/lib/esp32-device-api';

type VendoState = {
  deviceId?: string;
  deviceToken?: string;
  moneyInserted: number;
  remainingTime: number;
  totalTimeUsed: number;
  isActive: boolean;
  salesToday: number;
  totalEarnings: number;
  minCreditsToStart: number;
  secondsForMinCredits: number;
  wifiConnected: boolean;
  wifiSignal?: number;
  connectionStatus: string;
};

const defaultState: VendoState = {
  moneyInserted: 0,
  remainingTime: 0,
  totalTimeUsed: 0,
  isActive: false,
  salesToday: 0,
  totalEarnings: 0,
  minCreditsToStart: 50,
  secondsForMinCredits: 3000,
  wifiConnected: false,
  connectionStatus: 'Connecting',
};

export default function VendoControl() {
  const { ip, token, deviceId, deviceToken } = useLocalSearchParams<{ ip?: string; token?: string; deviceId?: string; deviceToken?: string }>();
  const [state, setState] = useState<VendoState>({ ...defaultState, deviceId, deviceToken });
  const [timeDelta, setTimeDelta] = useState('');
  const [pesoAmount, setPesoAmount] = useState('1');
  const [minutesAmount, setMinutesAmount] = useState('1');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [wifiEnabled, setWifiEnabled] = useState(true);

  const fetchState = useCallback(async () => {
    if (!ip) return;
    try {
      const data = await esp32Api.getStatus(ip, token);
      setState({
        deviceId: data?.deviceId || deviceId,
        deviceToken: data?.deviceToken || deviceToken,
        moneyInserted: Number(data?.moneyInserted ?? data?.money ?? data?.credits ?? 0),
        remainingTime: Number(data?.remainingTime ?? 0),
        totalTimeUsed: Number(data?.totalTimeUsed ?? data?.totalTime ?? 0),
        isActive: Boolean(data?.isActive),
        salesToday: Number(data?.salesToday ?? data?.money ?? 0),
        totalEarnings: Number(data?.totalEarnings ?? 0),
        minCreditsToStart: Number(data?.minCreditsToStart ?? 50),
        secondsForMinCredits: Number(data?.secondsForMinCredits ?? 3000),
        wifiConnected: Boolean(data?.wifiConnected),
        wifiSignal: typeof data?.wifiSignal === 'number' ? data.wifiSignal : undefined,
        connectionStatus: 'Online / Connected',
      });
      setWifiEnabled(Boolean(data?.wifiConnected));
    } catch (error) {
      setState((current) => ({ ...current, connectionStatus: 'Offline / Unreachable', wifiConnected: false }));
      Alert.alert('Connection issue', error instanceof Error ? error.message : 'ESP32 is offline or unreachable.');
    } finally {
      setLoading(false);
    }
  }, [deviceId, deviceToken, ip, token]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, [fetchState]);

  const resetMoney = async () => {
    if (!ip) return;
    try {
      setSubmitting(true);
      await esp32Api.resetMoney(ip, token);
      await fetchState();
    } catch (error) {
      Alert.alert('Request failed', error instanceof Error ? error.message : 'Failed to send reset command.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateTime = async () => {
    if (!ip) return;
    const seconds = Number(timeDelta);
    if (Number.isNaN(seconds)) {
      Alert.alert('Invalid value', 'Enter a number of seconds to add to the ESP32 timer.');
      return;
    }
    try {
      setSubmitting(true);
      await esp32Api.addTime(ip, token, seconds);
      setTimeDelta('');
      await fetchState();
    } catch (error) {
      Alert.alert('Request failed', error instanceof Error ? error.message : 'Failed to update time.');
    } finally {
      setSubmitting(false);
    }
  };

  const savePricing = async () => {
    if (!ip) return;
    const pesos = Number(pesoAmount);
    const minutes = Number(minutesAmount);
    if (!pesos || !minutes || pesos < 1 || minutes < 1) {
      Alert.alert('Invalid pricing', 'Enter valid peso and minute values.');
      return;
    }
    try {
      setSubmitting(true);
      await esp32Api.updateSettings(ip, token, pesos, minutes * 60);
      await fetchState();
    } catch (error) {
      Alert.alert('Request failed', error instanceof Error ? error.message : 'Failed to save pricing settings.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleWifi = async (enabled: boolean) => {
    if (!ip) return;
    setWifiEnabled(enabled);
    try {
      await esp32Api.setWifiEnabled(ip, token, enabled);
      if (enabled) setTimeout(fetchState, 2500);
    } catch (error) {
      setWifiEnabled(!enabled);
      Alert.alert('WiFi command failed', error instanceof Error ? error.message : 'Failed to update WiFi state.');
    }
  };

  return (
    <AppShell title="Vendo Control">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.heading}>Session Status</Text>
          <Text style={styles.text}>Device IP: {ip ?? 'N/A'}</Text>
          <Text style={styles.text}>Device ID: {state.deviceId || 'N/A'}</Text>
          <Text style={styles.text}>Pairing Token: {state.deviceToken || 'Hidden until firmware exposes it'}</Text>
          <Text style={styles.text}>Connection: {state.connectionStatus}</Text>
          <Text style={styles.text}>Money Inserted / Credits: ₱{state.moneyInserted}</Text>
          <Text style={styles.text}>Remaining Time: {state.remainingTime}s</Text>
          <Text style={styles.text}>Total Usage Time: {state.totalTimeUsed}s</Text>
          <Text style={styles.text}>Sales Today: ₱{state.salesToday}</Text>
          <Text style={styles.text}>Total Sales/Money: ₱{state.totalEarnings}</Text>
          <Text style={styles.text}>WiFi: {state.wifiConnected ? `Online (${state.wifiSignal ?? '--'} dBm)` : 'Offline / AP mode'}</Text>
          <Text style={[styles.status, state.isActive ? styles.active : styles.inactive]}>
            {state.isActive ? 'Session Active / Relay Open' : 'Session Inactive / Relay Closed'}
          </Text>
          {loading && <ActivityIndicator color={palette.accent} />}
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Controls</Text>
          <Pressable style={styles.button} onPress={resetMoney} disabled={submitting}>
            <Text style={styles.buttonText}>{submitting ? 'Sending...' : 'Reset Sales / Money'}</Text>
          </Pressable>
          <TextInput
            value={timeDelta}
            onChangeText={setTimeDelta}
            placeholder="Custom time to add in seconds (e.g., 300)"
            placeholderTextColor={palette.muted}
            style={styles.input}
            keyboardType="numbers-and-punctuation"
          />
          <Pressable style={styles.button} onPress={updateTime} disabled={submitting}>
            <Text style={styles.buttonText}>{submitting ? 'Sending...' : 'Submit / Add Time'}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Pricing Settings</Text>
          <Text style={styles.helper}>Current firmware pricing: ₱{state.minCreditsToStart} = {Math.round(state.secondsForMinCredits / 60)} minutes.</Text>
          <View style={styles.row}>
            <TextInput value={pesoAmount} onChangeText={setPesoAmount} placeholder="Pesos" placeholderTextColor={palette.muted} style={[styles.input, styles.flex]} keyboardType="numeric" />
            <TextInput value={minutesAmount} onChangeText={setMinutesAmount} placeholder="Minutes" placeholderTextColor={palette.muted} style={[styles.input, styles.flex]} keyboardType="numeric" />
          </View>
          <Pressable style={styles.button} onPress={savePricing} disabled={submitting}>
            <Text style={styles.buttonText}>Save Pricing to ESP32</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>WiFi Control</Text>
          <Text style={styles.helper}>Turning WiFi off keeps local relay, coin, timer, and LCD behavior running. Re-enable from the still-running setup AP at 192.168.4.1 if local STA disconnects.</Text>
          <View style={styles.switchRow}>
            <Text style={styles.text}>ESP32 WiFi Connection</Text>
            <Switch value={wifiEnabled} onValueChange={toggleWifi} />
          </View>
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
  helper: { color: palette.muted, lineHeight: 20 },
  status: { fontWeight: '700' },
  active: { color: '#60A5FA' },
  inactive: { color: '#FCA5A5' },
  input: { backgroundColor: '#111', borderWidth: 1, borderColor: '#2D2D2D', borderRadius: 12, color: palette.text, paddingHorizontal: 12, paddingVertical: 10 },
  button: { backgroundColor: '#1D4ED8', borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 42 },
  buttonText: { color: '#fff', fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
