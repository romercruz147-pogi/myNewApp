import React, { useState } from 'react';
import { Alert } from 'react-native';
import { loginDevice } from '../api/iotBackendApi';
import { Screen } from '../components/Screen';
import { TopBar } from '../components/layout/TopBar';
import { Card } from '../components/ui/Card';
import { TextField } from '../components/forms/TextField';
import { AppButton } from '../components/ui/Button';

export function RomersVendoScreen({ navigation }: any) {
  const [deviceId, setDeviceId] = useState('');
  const [secret, setSecret] = useState('');
  return <Screen><TopBar title='Link Device' subtitle='Authenticate vending machine' /><Card><TextField label='Device ID' placeholder='Device ID' value={deviceId} onChangeText={setDeviceId} /><TextField label='Device Secret' placeholder='Device Secret' value={secret} onChangeText={setSecret} secureTextEntry /><AppButton title='Login Device' onPress={async () => {
      try { const r = await loginDevice(deviceId, secret); navigation.replace('VendoControl', { deviceId, ipAddress: r.ipAddress }); }
      catch (e: any) { Alert.alert(e.message); }
    }} /></Card></Screen>;
}
