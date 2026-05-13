import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Card } from '../ui/Card';
import { theme } from '../../theme';

export function StatCard({ label, value }: any) {
  return <Card style={styles.card}><Text style={styles.value}>{value}</Text><Text style={styles.label}>{label}</Text></Card>;
}
const styles = StyleSheet.create({ card: { flex: 1 }, value: { color: theme.colors.text, ...theme.typography.h2 }, label: { color: theme.colors.textMuted } });
