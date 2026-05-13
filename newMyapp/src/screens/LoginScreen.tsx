import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Screen } from '../components/Screen';
import { emailLogin, loginWithGoogle } from '../services/authService';
import { TopBar } from '../components/layout/TopBar';
import { Card } from '../components/ui/Card';
import { TextField } from '../components/forms/TextField';
import { AppButton } from '../components/ui/Button';

export function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const runLogin = async (fn: () => Promise<void>) => {
    try { setLoading(true); await fn(); navigation.replace('Dashboard'); }
    catch (e: any) { Alert.alert(e.message); }
    finally { setLoading(false); }
  };

  return <Screen><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}><TopBar title='Welcome back' subtitle='Manage your IoT vending devices' /><Card><TextField label='Email' placeholder='Email' value={email} onChangeText={setEmail} autoCapitalize='none' /><TextField label='Password' placeholder='Password' secureTextEntry value={password} onChangeText={setPassword} /><AppButton title={loading ? 'Logging in...' : 'Login'} onPress={() => runLogin(() => emailLogin(email, password))} disabled={loading} /><AppButton variant='secondary' title='Google Login' onPress={() => runLogin(loginWithGoogle)} disabled={loading} /><AppButton variant='secondary' title='Go Register' onPress={() => navigation.navigate('Register')} /></Card></KeyboardAvoidingView></Screen>;
}
