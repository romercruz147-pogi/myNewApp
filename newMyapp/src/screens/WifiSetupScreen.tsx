import React, { useEffect, useState } from 'react';
import {
  Button,
  FlatList,
  Text,
  TextInput,
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Screen } from '../components/Screen';
import { espScanNetworks, espSetupWifi } from '../api/esp32Api';
import { colors } from '../theme/colors';

export function WifiSetupScreen({ route }: any) {
  const { ipAddress } = route.params;
  const [networks, setNetworks] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    scanNetworks();
  }, [ipAddress]);

  const scanNetworks = async () => {
    setIsScanning(true);
    setError(null);
    try {
      const foundNetworks = await espScanNetworks(ipAddress);
      setNetworks(Array.isArray(foundNetworks) ? foundNetworks : []);
    } catch (e: any) {
      setError('Failed to scan WiFi networks. Check device connection.');
      Alert.alert('Scan Error', e.message || 'Failed to scan networks');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSetupWifi = async () => {
    if (!selectedNetwork || !password) {
      setError('Please select a network and enter a password');
      return;
    }
    setIsSettingUp(true);
    setError(null);
    try {
      await espSetupWifi(ipAddress, selectedNetwork, password);
      Alert.alert('Success', 'WiFi setup completed');
      setPassword('');
      setSelectedNetwork(null);
      await scanNetworks();
    } catch (e: any) {
      setError('Failed to setup WiFi');
      Alert.alert('Setup Error', e.message || 'Failed to setup WiFi');
    } finally {
      setIsSettingUp(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>WiFi Setup</Text>
        <Button
          title={isScanning ? 'Scanning...' : 'Rescan'}
          onPress={scanNetworks}
          disabled={isScanning || isSettingUp}
        />
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.label}>Available Networks:</Text>
      {isScanning && networks.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size='large' color={colors.primary} />
          <Text style={styles.scanningText}>Scanning for networks...</Text>
        </View>
      ) : networks.length === 0 ? (
        <Text style={styles.emptyText}>No networks found</Text>
      ) : (
        <FlatList
          data={networks}
          keyExtractor={(item, index) => index.toString()}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.networkItem,
                selectedNetwork === item && styles.networkItemSelected,
              ]}
              onPress={() => setSelectedNetwork(item)}
            >
              <Text
                style={[
                  styles.networkName,
                  selectedNetwork === item && styles.networkNameSelected,
                ]}
              >
                {selectedNetwork === item ? '✓ ' : ''}{item}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      <Text style={styles.label}>Password:</Text>
      <TextInput
        style={styles.input}
        placeholder='Enter WiFi password'
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!isSettingUp}
        placeholderTextColor={colors.muted}
      />

      <Button
        title={isSettingUp ? 'Setting up...' : 'Setup WiFi'}
        onPress={handleSetupWifi}
        disabled={isSettingUp || !selectedNetwork || !password}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  error: {
    backgroundColor: colors.error,
    color: '#fff',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
    fontSize: 13,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    marginTop: 12,
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  scanningText: {
    marginTop: 12,
    color: colors.text,
  },
  emptyText: {
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: 16,
  },
  networkItem: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  networkItemSelected: {
    borderColor: colors.primary,
    backgroundColor: '#1a2332',
  },
  networkName: {
    color: colors.text,
    fontSize: 14,
  },
  networkNameSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
    color: colors.text,
    fontSize: 14,
    marginBottom: 16,
  },
});
