import React from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { theme } from '../../theme';

export function AppShell({ children }: any) { return <SafeAreaView style={styles.root}><View style={styles.inner}>{children}</View></SafeAreaView>; }
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: theme.colors.bg }, inner: { flex: 1, padding: theme.spacing.lg } });
