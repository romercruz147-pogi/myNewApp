import React, { useState } from 'react';
import {
  Button,
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Screen } from '../components/Screen';
import { logout } from '../services/authService';
import { colors } from '../theme/colors';
import { auth } from '../config/firebase';

export function SettingsScreen({ navigation }: any) {
  const [isLoading, setIsLoading] = useState(false);
  const user = auth.currentUser;

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await logout();
      navigation.replace('Login');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to logout');
      setIsLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>Settings</Text>

        {user && (
          <View style={styles.userCard}>
            <Text style={styles.userEmail}>{user.email}</Text>
            <Text style={styles.userHint}>Signed in</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          {isLoading ? (
            <ActivityIndicator size='large' color={colors.primary} />
          ) : (
            <Button
              title='Logout'
              onPress={handleLogout}
              color={colors.error}
            />
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 24,
  },
  userCard: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  userHint: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
});
