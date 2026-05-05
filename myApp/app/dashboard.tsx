import { StyleSheet, Switch, Text, View } from 'react-native';
import { AppShell } from '@/components/app-shell';
import { palette } from '@/components/theme';

export default function Dashboard() {
  return (
    <AppShell title="Dashboard">
      <Text style={styles.subtitle}>Welcome back. Your ESP32 fleet is online.</Text>
      <View style={styles.row}>
        {['Online Devices: 8', 'Alerts: 2', 'Energy Today: 12.4kWh'].map((t) => <View key={t} style={styles.card}><Text style={styles.cardText}>{t}</Text></View>)}
      </View>
      <View style={styles.card}><Text style={styles.cardText}>Quick Toggle: Main Pump</Text><Switch value /></View>
    </AppShell>
  );
}
const styles = StyleSheet.create({ subtitle:{color:palette.muted}, row:{flexDirection:'row', gap:12, flexWrap:'wrap'}, card:{backgroundColor:'#1E1E1E', borderRadius:18, padding:16, minWidth:180, borderWidth:1,borderColor:palette.border}, cardText:{color:palette.text}});
