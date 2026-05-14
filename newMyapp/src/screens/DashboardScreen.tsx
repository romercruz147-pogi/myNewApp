import React, { useEffect } from 'react';
import { Button, FlatList, Text, TouchableOpacity, View, StyleSheet, ActivityIndicator } from 'react-native';
import { auth } from '../config/firebase';
import { Screen } from '../components/Screen';
import { useDevices } from '../hooks/useDevices';
import { isDeviceConnected } from '../utils/connectivity';
import { colors } from '../theme/colors';

export function DashboardScreen({ navigation }: any) {
  const uid = auth.currentUser?.uid;
  const devices = useDevices(uid);

  useEffect(() => {
    // Add settings button to header if navigation supports it
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  if (!uid) {
    return (
      <Screen>
        <View style={styles.container}>
          <Text style={styles.error}>User not authenticated. Please log in again.</Text>
          <Button title='Go to Login' onPress={() => navigation.navigate('Login')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>My Devices</Text>
        <Button title='Settings' onPress={() => navigation.navigate('Settings')} />
      </View>
      <Button
        title='+ Link New Device (Romers Vendo)'
        onPress={() => navigation.navigate('RomersVendo')}
      />
      {devices.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No devices linked yet</Text>
          <Text style={styles.emptyHint}>Tap "Link New Device" to get started</Text>
        </View>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.deviceItem}
              onPress={() =>
                navigation.navigate('VendoControl', {
                  deviceId: item.id,
                  ipAddress: item.ipAddress,
                })
              }
            >
              <Text style={styles.deviceName}>
                {item.name || item.id}
              </Text>
              <Text
                style={[
                  styles.deviceStatus,
                  isDeviceConnected(item)
                    ? styles.connected
                    : styles.offline,
                ]}
              >
                {isDeviceConnected(item) ? '🟢 Connected' : '🔴 Offline'}
              </Text>
            </TouchableOpacity>
          )}
          scrollEnabled={false}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  error: {
    fontSize: 16,
    color: colors.error,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: colors.muted,
  },
  deviceItem: {
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  deviceStatus: {
    fontSize: 14,
  },
  connected: {
    color: colors.success,
  },
  offline: {
    color: colors.error,
  },
});
