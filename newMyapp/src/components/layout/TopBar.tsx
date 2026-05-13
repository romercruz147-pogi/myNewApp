import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';

export function TopBar({ title, subtitle }: any) { return <View style={styles.wrap}><Text style={styles.title}>{title}</Text>{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}</View>; }
const styles = StyleSheet.create({ wrap: { marginBottom: theme.spacing.lg }, title: { color: theme.colors.text, ...theme.typography.h2 }, subtitle: { color: theme.colors.textMuted, ...theme.typography.body } });
