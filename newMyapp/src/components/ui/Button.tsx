import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '../../theme';

export function AppButton({ title, onPress, variant = 'primary', disabled = false }: any) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.base, styles[variant], disabled && styles.disabled]}>
      <Text style={styles.label}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: theme.radius.md, alignItems: 'center', marginVertical: 6 },
  primary: { backgroundColor: theme.colors.primary },
  secondary: { backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border },
  danger: { backgroundColor: theme.colors.danger },
  disabled: { opacity: 0.5 },
  label: { color: theme.colors.text, ...theme.typography.body, fontWeight: '600' },
});
