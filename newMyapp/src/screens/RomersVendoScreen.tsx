import React, { useState } from 'react';
import {
  Alert,
  Button,
  TextInput,
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
} from 'react-native';
import { loginDevice } from '../api/iotBackendApi';
import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';

export function RomersVendoScreen({ navigation }: any) {
  const [deviceId, setDeviceId] = useState('');
  const [secret, setSecret] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!deviceId || !secret) {
      setError('Please enter Device ID and Secret');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const response = await loginDevice(deviceId, secret);
      if (!response.ipAddress) {
        throw new Error('No IP address returned from server');
      }
      navigation.navigate('VendoControl', {
        deviceId,
        ipAddress: response.ipAddress,
      });
    } catch (e: any) {
      const errorMsg = e.message || 'Failed to authenticate device';
      setError(errorMsg);
      Alert.alert('Authentication Error', errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>Link Device</Text>
        <Text style={styles.subtitle}>
          Enter your Romers Vendo device credentials
        </Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <TextInput
          style={styles.input}
          placeholder='Device ID'
          value={deviceId}
          onChangeText={setDeviceId}
          editable={!isLoading}
          autoCapitalize='none'
          placeholderTextColor={colors.muted}
        />

        <TextInput
          style={styles.input}
          placeholder='Device Secret'
          value={secret}
          onChangeText={setSecret}
          secureTextEntry
          editable={!isLoading}
          placeholderTextColor={colors.muted}
        />

        {isLoading ? (
          <ActivityIndicator size='large' color={colors.primary} />
        ) : (
          <Button title='Link Device' onPress={handleLogin} />
        )}

        <Button
          title='← Back'
          onPress={() => navigation.goBack()}
          disabled={isLoading}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 32,
  },
  error: {
    backgroundColor: colors.error,
    color: '#fff',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
    overflow: 'hidden',
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    color: colors.text,
    fontSize: 14,
  },
});
