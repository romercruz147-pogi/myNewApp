import React, { useEffect, useState } from 'react';
import { FlatList, Text, TouchableOpacity } from 'react-native';
import { Screen } from '../components/Screen';
import { espScanNetworks, espSetupWifi } from '../api/esp32Api';
import { TopBar } from '../components/layout/TopBar';
import { TextField } from '../components/forms/TextField';
import { Card } from '../components/ui/Card';
import { AppButton } from '../components/ui/Button';

export function WifiSetupScreen({ route }: any) {
  const { ipAddress } = route.params;
  const [networks, setNetworks] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [password, setPassword] = useState('');
  useEffect(() => { espScanNetworks(ipAddress).then(setNetworks); }, [ipAddress]);
  return <Screen><TopBar title='WiFi Setup' subtitle='Step 1: pick network, Step 2: connect' /><FlatList data={networks} keyExtractor={(n) => n} renderItem={({ item }) => <TouchableOpacity onPress={() => setSelected(item)}><Card style={{ marginBottom: 8 }}><Text style={{ color: '#E7EDF7' }}>{item}{selected === item ? ' ✓' : ''}</Text></Card></TouchableOpacity>} /><TextField label='WiFi password' placeholder='WiFi password' value={password} onChangeText={setPassword} secureTextEntry /><AppButton title='Connect Selected SSID' onPress={() => selected && espSetupWifi(ipAddress, selected, password)} /></Screen>;
}
