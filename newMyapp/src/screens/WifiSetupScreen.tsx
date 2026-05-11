import React, { useEffect, useState } from 'react';
import { Button, FlatList, Text, TextInput } from 'react-native';
import { Screen } from '../components/Screen';
import { espScanNetworks, espSetupWifi } from '../api/esp32Api';

export function WifiSetupScreen({ route }: any) {
  const { ipAddress } = route.params;
  const [networks, setNetworks] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  useEffect(() => { espScanNetworks(ipAddress).then(setNetworks); }, [ipAddress]);
  return <Screen>
    <FlatList data={networks} keyExtractor={(n) => n} renderItem={({ item }) => <Text>{item}</Text>} />
    <TextInput placeholder='WiFi password' value={password} onChangeText={setPassword} secureTextEntry />
    <Button title='Setup First SSID' onPress={() => networks[0] && espSetupWifi(ipAddress, networks[0], password)} />
  </Screen>;
}
