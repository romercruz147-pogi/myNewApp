import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../../theme';

export function TextField({ label, ...props }: any) {
  return <View style={styles.wrap}>{label ? <Text style={styles.label}>{label}</Text> : null}<TextInput placeholderTextColor={theme.colors.textMuted} style={styles.input} {...props} /></View>;
}
const styles = StyleSheet.create({
  wrap: { marginBottom: theme.spacing.md },
  label: { color: theme.colors.textMuted, marginBottom: 6, ...theme.typography.caption },
  input: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.md, color: theme.colors.text, padding: 12 },
});
