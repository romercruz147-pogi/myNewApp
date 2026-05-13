import React, { useMemo } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../config/firebase';
import { Screen } from '../components/Screen';
import { useDevices } from '../hooks/useDevices';
import { isDeviceConnected } from '../utils/connectivity';
import { TopBar } from '../components/layout/TopBar';
import { StatCard } from '../components/dashboard/StatCard';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { SectionHeader } from '../components/layout/SectionHeader';
import { AppButton } from '../components/ui/Button';
import { EmptyState } from '../components/ui/States';

export function DashboardScreen({ navigation }: any) {
  const devices = useDevices(auth.currentUser?.uid);
  const stats = useMemo(() => ({ total: devices.length, online: devices.filter(isDeviceConnected).length }), [devices]);

  return <Screen><TopBar title='Dashboard' subtitle='Live machine overview' /><AppButton title='Romers Vendo Link' onPress={() => navigation.navigate('RomersVendo')} /><View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}><StatCard label='Total Devices' value={stats.total} /><StatCard label='Connected' value={stats.online} /></View><SectionHeader title='Devices' /><FlatList data={devices} keyExtractor={(item) => item.id} ListEmptyComponent={<EmptyState text='No devices found yet.' />} renderItem={({ item }) => (<TouchableOpacity onPress={() => navigation.navigate('VendoControl', { deviceId: item.id, ipAddress: item.ipAddress })}><Card style={{ marginBottom: 12 }}><Text style={{ color: '#E7EDF7', fontWeight: '700' }}>{item.name || item.id}</Text><Badge text={isDeviceConnected(item) ? 'Connected' : 'Offline'} tone={isDeviceConnected(item) ? 'success' : 'danger'} /></Card></TouchableOpacity>)} /> </Screen>;
}
