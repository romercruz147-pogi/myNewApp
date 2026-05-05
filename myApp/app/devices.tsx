import { StyleSheet, Switch, Text, View } from 'react-native';
import { AppShell } from '@/components/app-shell';
import { palette } from '@/components/theme';

const devices = [
  { name: 'Greenhouse Node', temp: '26°C', humidity: '48%', on: true },
  { name: 'Tank Monitor', temp: '24°C', humidity: '60%', on: false },
];

export default function Devices() {
  return <AppShell title="Device Control">{devices.map((d)=> <View key={d.name} style={styles.card}><Text style={styles.name}>{d.name}</Text><Text style={styles.meta}>Temp {d.temp} • Humidity {d.humidity}</Text><Switch value={d.on} /></View>)}</AppShell>;
}
const styles=StyleSheet.create({card:{backgroundColor:'#1E1E1E',borderRadius:18,padding:16,marginBottom:12,borderWidth:1,borderColor:palette.border},name:{color:palette.text,fontWeight:'700'},meta:{color:palette.muted,marginVertical:8}});
