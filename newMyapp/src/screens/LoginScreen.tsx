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
import { emailLogin, loginWithGoogle } from '../services/authService';
import { colors } from '../theme/colors';

export function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailLogin = async () => {
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await emailLogin(email, password);
      navigation.replace('Dashboard');
    } catch (e: any) {
      setError(e.message || 'Login failed');
      Alert.alert('Login Error', e.message || 'Failed to log in');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await loginWithGoogle();
      navigation.replace('Dashboard');
    } catch (e: any) {
      setError(e.message || 'Google login failed');
      Alert.alert('Login Error', e.message || 'Failed to log in with Google');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        {error && <Text style={styles.error}>{error}</Text>}

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
          placeholder='Password'
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!isLoading}
          placeholderTextColor={colors.muted}
        />

        {isLoading ? (
          <ActivityIndicator size='large' color={colors.primary} />
        ) : (
          <>
            <Button title='Login' onPress={handleEmailLogin} />
            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.line} />
            </View>
            <Button title='Login with Google' onPress={handleGoogleLogin} />
          </>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Button
            title='Sign Up'
            onPress={() => navigation.navigate('Register')}
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.muted,
  },
  dividerText: {
    marginHorizontal: 8,
    color: colors.muted,
    fontSize: 12,
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
