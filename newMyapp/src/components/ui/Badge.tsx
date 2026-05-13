import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';

export function Badge({ text, tone = 'success' }: any) {
  return <View style={[styles.badge, { backgroundColor: tone === 'success' ? '#173F2F' : '#40222A' }]}><Text style={styles.text}>{text}</Text></View>;
}
const styles = StyleSheet.create({ badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill }, text: { color: theme.colors.text, ...theme.typography.caption } });
