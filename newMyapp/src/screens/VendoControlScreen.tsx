import React, { useEffect, useState } from 'react';
import { Alert, Button, Text } from 'react-native';
import { Screen } from '../components/Screen';
import { espAddTime, espGetStatus, espResetMoney } from '../api/esp32Api';

export function VendoControlScreen({ route }: any) {
  const { ipAddress } = route.params;
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    if (!ipAddress) return;
    const t = setInterval(async () => {
      try { setStatus(await espGetStatus(ipAddress)); }
      catch { Alert.alert('Device offline'); }
    }, 3000);
    return () => clearInterval(t);
  }, [ipAddress]);

  return <Screen>
    <Text>Money: {status?.money ?? 0}</Text>
    <Button title='Reset Money' onPress={() => espResetMoney(ipAddress)} />
    <Button title='Add 300 sec' onPress={() => espAddTime(ipAddress, 300)} />
  </Screen>;
}
