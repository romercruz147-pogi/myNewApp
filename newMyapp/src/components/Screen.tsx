import React, { PropsWithChildren } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export const Screen = ({ children }: PropsWithChildren) => <SafeAreaView style={styles.root}>{children}</SafeAreaView>;

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.background, padding: 16 } });
