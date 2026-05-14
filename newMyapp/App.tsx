import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { StatusBar, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { AppNavigator } from './src/navigation/AppNavigator';
import { auth } from './src/config/firebase';
import { colors } from './src/theme/colors';

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Wait for Firebase auth to initialize
        await new Promise<void>((resolve) => {
          const unsubscribe = auth.onAuthStateChanged(() => {
            unsubscribe();
            resolve();
          });
        });
        setIsInitialized(true);
      } catch (error) {
        setInitError(
          error instanceof Error ? error.message : 'Failed to initialize app'
        );
        setIsInitialized(true);
      }
    };

    initializeApp();
  }, []);

  if (initError) {
    return (
      <View style={styles.errorRoot}>
        <StatusBar barStyle='light-content' />
        <Text style={styles.title}>Initialization Error</Text>
        <Text style={styles.body}>{initError}</Text>
        <Text style={styles.hint}>Check Firebase configuration in app.json</Text>
      </View>
    );
  }

  if (!isInitialized) {
    return (
      <View style={styles.loadingRoot}>
        <StatusBar barStyle='light-content' />
        <ActivityIndicator size='large' color={colors.primary} />
        <Text style={styles.loadingText}>Initializing...</Text>
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
  errorRoot: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: 20,
  },
  loadingRoot: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: colors.error,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  body: {
    color: colors.text,
    marginBottom: 8,
    fontSize: 16,
  },
  hint: {
    color: colors.muted,
    marginTop: 16,
    fontSize: 13,
  },
  loadingText: {
    color: colors.text,
    marginTop: 12,
    fontSize: 14,
  },
});
