import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { AppNavigator } from './src/navigation/AppNavigator';
import { getMissingRuntimeKeys } from './src/config/runtime';

export default function App() {
  const missingKeys = getMissingRuntimeKeys();

  if (missingKeys.length > 0) {
    return (
      <View style={styles.errorRoot}>
        <StatusBar barStyle='light-content' />
        <Text style={styles.title}>Missing Firebase config in app.json</Text>
        <Text style={styles.body}>Set expo.extra keys before running auth/data features:</Text>
        {missingKeys.map((key) => (
          <Text key={key} style={styles.key}>• {key}</Text>
        ))}
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle='light-content' />
      <AppNavigator />
    </>
  );
}

const styles = StyleSheet.create({
  errorRoot: { flex: 1, backgroundColor: '#0E1015', justifyContent: 'center', padding: 20 },
  title: { color: '#FF5B6A', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  body: { color: '#EAF0FF', marginBottom: 8 },
  key: { color: '#9AA3B2', marginBottom: 2 },
});
