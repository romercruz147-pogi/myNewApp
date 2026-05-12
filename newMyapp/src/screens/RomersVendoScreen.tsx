import React, { useState } from 'react';
import { Alert, Button, TextInput } from 'react-native';
import { loginDevice } from '../api/iotBackendApi';
import { Screen } from '../components/Screen';

export function RomersVendoScreen({ navigation }: any) {
  const [deviceId, setDeviceId] = useState('');
  const [secret, setSecret] = useState('');
  return <Screen>
    <TextInput placeholder='Device ID' value={deviceId} onChangeText={setDeviceId} />
    <TextInput placeholder='Device Secret' value={secret} onChangeText={setSecret} secureTextEntry />
    <Button title='Login Device' onPress={async () => {
      try { const r = await loginDevice(deviceId, secret); navigation.replace('VendoControl', { deviceId, ipAddress: r.ipAddress }); }
      catch (e: any) { Alert.alert(e.message); }
    }} />
  </Screen>;
}
