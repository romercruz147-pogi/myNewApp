import React, { PropsWithChildren } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

export const Screen = ({ children }: PropsWithChildren) => (
  <SafeAreaView style={styles.root}>
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      bounces={false}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.content}>{children}</View>
    </ScrollView>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1 },
  content: { flex: 1, padding: 16 },
});
