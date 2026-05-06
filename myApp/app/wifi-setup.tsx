import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';

interface WiFiNetwork {
  ssid: string;
  rssi: number;
  secure: number;
  channel: number;
}

export default function WiFiSetupScreen() {
  const router = useRouter();
  const [deviceIP, setDeviceIP] = useState('192.168.4.1'); // ESP32 AP default IP
  const [networks, setNetworks] = useState<WiFiNetwork[]>([]);
  const [scanning, setScanning] = useState(false);
  const [selectedSSID, setSelectedSSID] = useState('');
  const [password, setPassword] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [step, setStep] = useState<'scan' | 'connect'>('scan');

  const scanNetworks = async () => {
    setScanning(true);
    try {
      const response = await fetch(`http://${deviceIP}/api/scan-networks`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Failed to scan networks');

      const data = await response.json();
      setNetworks(data.networks || []);

      if (!data.networks || data.networks.length === 0) {
        Alert.alert('Info', 'No WiFi networks found.');
      }
    } catch (error) {
      Alert.alert('Error', `Failed to scan networks: ${error}`);
      console.error(error);
    } finally {
      setScanning(false);
    }
  };

  const connectToWiFi = async () => {
    if (!selectedSSID.trim()) {
      Alert.alert('Error', 'Please select a WiFi network');
      return;
    }

    setConnecting(true);
    try {
      const response = await fetch(`http://${deviceIP}/api/setup-wifi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ssid: selectedSSID,
          password: password,
        }),
      });

      if (!response.ok) throw new Error('Failed to connect');

      const data = await response.json();
      Alert.alert('Success', 'WiFi credentials saved! Device is rebooting...');

      // Wait for device to reboot and reconnect
      setTimeout(() => {
        router.replace('/dashboard');
      }, 3000);
    } catch (error) {
      Alert.alert('Error', `Failed to connect: ${error}`);
      console.error(error);
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    // Auto-scan on mount
    scanNetworks();
  }, []);

  const renderNetworkItem = ({ item }: { item: WiFiNetwork }) => (
    <TouchableOpacity
      style={[
        styles.networkItem,
        selectedSSID === item.ssid && styles.selectedNetwork,
      ]}
      onPress={() => {
        setSelectedSSID(item.ssid);
        setStep('connect');
      }}
    >
      <View style={styles.networkInfo}>
        <Text style={styles.networkName}>{item.ssid}</Text>
        <Text style={styles.networkSignal}>
          Signal: {item.rssi} dBm {item.secure ? '🔒' : ''}
        </Text>
      </View>
      {selectedSSID === item.ssid && <Text style={styles.checkmark}>✓</Text>}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>WiFi Setup</Text>
        <Text style={styles.subtitle}>
          Connect your vending machine to your home WiFi
        </Text>
      </View>

      {step === 'scan' ? (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Available Networks</Text>

          {scanning ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color="#1877f2" />
              <Text style={styles.loadingText}>Scanning networks...</Text>
            </View>
          ) : networks.length > 0 ? (
            <>
              <FlatList
                data={networks}
                renderItem={renderNetworkItem}
                keyExtractor={(item) => item.ssid}
                scrollEnabled={false}
                style={styles.networkList}
              />
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={scanNetworks}
                disabled={scanning}
              >
                <Text style={styles.buttonText}>Refresh Networks</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.centerContent}>
              <Text style={styles.emptyText}>No networks found</Text>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={scanNetworks}
                disabled={scanning}
              >
                <Text style={styles.buttonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              💡 Make sure your device is within range of the network you want
              to connect to.
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Enter Password</Text>

          <View style={styles.selectedBox}>
            <Text style={styles.selectedLabel}>Selected Network</Text>
            <Text style={styles.selectedSSID}>{selectedSSID}</Text>
          </View>

          <Text style={styles.label}>WiFi Password (if required)</Text>
          <TextInput
            style={styles.input}
            placeholder="Leave blank if no password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!connecting}
          />

          <TouchableOpacity
            style={[styles.connectButton, connecting && styles.buttonDisabled]}
            onPress={connectToWiFi}
            disabled={connecting}
          >
            {connecting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.buttonText}>Connect</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep('scan')}
            disabled={connecting}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#1877f2',
    padding: 20,
    paddingBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#e3f2fd',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  networkList: {
    marginBottom: 16,
  },
  networkItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedNetwork: {
    borderColor: '#1877f2',
    borderWidth: 2,
    backgroundColor: '#f0f7ff',
  },
  networkInfo: {
    flex: 1,
  },
  networkName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  networkSignal: {
    fontSize: 12,
    color: '#666',
  },
  checkmark: {
    fontSize: 20,
    color: '#1877f2',
    fontWeight: 'bold',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 16,
  },
  refreshButton: {
    backgroundColor: '#1877f2',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  connectButton: {
    backgroundColor: '#28a745',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  backButton: {
    backgroundColor: '#ccc',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  backButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  selectedBox: {
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#1877f2',
  },
  selectedLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  selectedSSID: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1877f2',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 14,
  },
  infoBox: {
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  infoText: {
    fontSize: 13,
    color: '#856404',
    lineHeight: 18,
  },
});
