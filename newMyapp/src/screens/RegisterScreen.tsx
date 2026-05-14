import React, { useState } from 'react';
import {
  Alert,
  Button,
  TextInput,
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
} from 'react-native';
import { Screen } from '../components/Screen';
import { emailRegister } from '../services/authService';
import { colors } from '../theme/colors';

export function RegisterScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!name || !email || !password) {
      setError('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await emailRegister(name, email, password);
      navigation.replace('Dashboard');
    } catch (e: any) {
      setError(e.message || 'Registration failed');
      Alert.alert('Registration Error', e.message || 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join us today</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <TextInput
          style={styles.input}
          placeholder='Full Name'
          value={name}
          onChangeText={setName}
          editable={!isLoading}
          placeholderTextColor={colors.muted}
        />

        <TextInput
          style={styles.input}
          placeholder='Email'
          value={email}
          onChangeText={setEmail}
          editable={!isLoading}
          keyboardType='email-address'
          autoCapitalize='none'
          placeholderTextColor={colors.muted}
        />

        <TextInput
          style={styles.input}
          placeholder='Password (min 6 characters)'
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!isLoading}
          placeholderTextColor={colors.muted}
        />

        {isLoading ? (
          <ActivityIndicator size='large' color={colors.primary} />
        ) : (
          <Button title='Create Account' onPress={handleRegister} />
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Button
            title='Sign In'
            onPress={() => navigation.navigate('Login')}
            disabled={isLoading}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 32,
  },
  error: {
    backgroundColor: colors.error,
    color: '#fff',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
    overflow: 'hidden',
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    color: colors.text,
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    color: colors.text,
  },
});
