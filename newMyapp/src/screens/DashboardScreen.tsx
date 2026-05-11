import React from 'react';
import { Button, FlatList, Text, TouchableOpacity } from 'react-native';
import { auth } from '../config/firebase';
import { Screen } from '../components/Screen';
import { useDevices } from '../hooks/useDevices';
import { isDeviceConnected } from '../utils/connectivity';

export function DashboardScreen({ navigation }: any) {
  const devices = useDevices(auth.currentUser?.uid);
  return <Screen>
    <Button title='Romers Vendo Link' onPress={() => navigation.navigate('RomersVendo')} />
    <FlatList data={devices} keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
      <TouchableOpacity onPress={() => navigation.navigate('VendoControl', { deviceId: item.id, ipAddress: item.ipAddress })}>
        <Text>{item.name || item.id} - {isDeviceConnected(item) ? 'Connected' : 'Offline'}</Text>
      </TouchableOpacity>
    )} />
  </Screen>;
}
