import React, { useEffect, useState } from 'react';
import { Alert, Text } from 'react-native';
import { Screen } from '../components/Screen';
import { espAddTime, espGetStatus, espResetMoney } from '../api/esp32Api';
import { TopBar } from '../components/layout/TopBar';
import { Card } from '../components/ui/Card';
import { AppButton } from '../components/ui/Button';

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

  return <Screen><TopBar title='Vendo Control' subtitle={ipAddress} /><Card><Text style={{ color: '#E7EDF7', marginBottom: 12 }}>Money: {status?.money ?? 0}</Text><AppButton title='Reset Money' onPress={() => espResetMoney(ipAddress)} variant='danger' /><AppButton title='Add 300 sec' onPress={() => espAddTime(ipAddress, 300)} /></Card></Screen>;
}
