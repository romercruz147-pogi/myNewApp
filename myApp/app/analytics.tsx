import { StyleSheet, Text, View } from 'react-native';
import { AppShell } from '@/components/app-shell';
import { palette } from '@/components/theme';

export default function Analytics() {
  return <AppShell title="Analytics"><View style={styles.chart}><Text style={styles.text}>Usage history chart placeholder</Text></View><View style={styles.chart}><Text style={styles.text}>Temperature trend placeholder</Text></View></AppShell>;
}
const styles=StyleSheet.create({chart:{height:180,backgroundColor:'#1E1E1E',borderRadius:18,justifyContent:'center',alignItems:'center',borderWidth:1,borderColor:palette.border,marginBottom:12},text:{color:palette.muted}});
