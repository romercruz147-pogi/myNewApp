import { StyleSheet, Text, View } from 'react-native';
import { AppShell } from '@/components/app-shell';
import { palette } from '@/components/theme';

export default function Settings() {
  return <AppShell title="Settings"><View style={styles.card}><Text style={styles.heading}>Profile</Text><Text style={styles.text}>Edit name, email, and password.</Text></View><View style={styles.card}><Text style={styles.heading}>ESP32 WiFi Config</Text><Text style={styles.text}>Manage SSID, password, and reconnect options.</Text></View><View style={styles.card}><Text style={styles.heading}>Notifications & Scheduling</Text><Text style={styles.text}>Configure alerts and automation schedules.</Text></View></AppShell>;
}
const styles=StyleSheet.create({card:{backgroundColor:'#1E1E1E',borderRadius:18,padding:16,borderWidth:1,borderColor:palette.border,marginBottom:12},heading:{color:palette.text,fontWeight:'700'},text:{color:palette.muted,marginTop:6}});
