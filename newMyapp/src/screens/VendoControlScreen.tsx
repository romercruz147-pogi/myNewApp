import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Screen } from '../components/Screen';
import { espAddTime, espGetStatus, espResetMoney } from '../api/esp32Api';
import { colors } from '../theme/colors';

export function VendoControlScreen({ route }: any) {
  const { ipAddress } = route.params;
  const [status, setStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ipAddress) {
      setError('No IP address provided');
      return;
    }

    setIsLoading(true);
    const fetchStatus = async () => {
      try {
        const data = await espGetStatus(ipAddress);
        setStatus(data);
        setError(null);
      } catch (e: any) {
        setError('Device is offline or unreachable');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();

    const interval = setInterval(async () => {
      try {
        const data = await espGetStatus(ipAddress);
        setStatus(data);
        setError(null);
      } catch (e: any) {
        setError('Device offline');
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [ipAddress]);

  const handleResetMoney = async () => {
    try {
      await espResetMoney(ipAddress);
      Alert.alert('Success', 'Money reset successfully');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to reset money');
    }
  };

  const handleAddTime = async () => {
    try {
      await espAddTime(ipAddress, 300);
      Alert.alert('Success', '300 seconds added');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add time');
    }
  };

  if (isLoading && !status) {
    return (
      <Screen>
        <View style={styles.centerContainer}>
          <ActivityIndicator size='large' color={colors.primary} />
          <Text style={styles.loadingText}>Connecting to device...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.title}>Device Control</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      {status && (
        <View style={styles.statusContainer}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Money:</Text>
            <Text style={styles.statusValue}>${status.money ?? 0}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Time Remaining:</Text>
            <Text style={styles.statusValue}>
              {status.timeRemaining ?? 0}s
            </Text>
          </View>
        </View>
      )}

      <View style={styles.controls}>
        <Button title='Add 300 Seconds' onPress={handleAddTime} />
        <Button title='Reset Money' onPress={handleResetMoney} color={colors.error} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  loadingText: {
    marginTop: 12,
    color: colors.text,
  },
  error: {
    backgroundColor: colors.error,
    color: '#fff',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
  },
  statusContainer: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  statusLabel: {
    fontSize: 14,
    color: colors.muted,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  controls: {
    gap: 12,
  },
});
