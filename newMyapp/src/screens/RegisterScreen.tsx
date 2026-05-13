import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { Screen } from '../components/Screen';
import { emailRegister } from '../services/authService';
import { TopBar } from '../components/layout/TopBar';
import { Card } from '../components/ui/Card';
import { TextField } from '../components/forms/TextField';
import { AppButton } from '../components/ui/Button';

export function RegisterScreen({ navigation }: any) {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  return <Screen><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}><TopBar title='Create account' subtitle='Start managing vending machines' /><Card><TextField label='Name' placeholder='Name' value={name} onChangeText={setName} /><TextField label='Email' placeholder='Email' value={email} onChangeText={setEmail} /><TextField label='Password' placeholder='Password' secureTextEntry value={password} onChangeText={setPassword} /><AppButton title={loading ? 'Creating...' : 'Create Account'} disabled={loading} onPress={async () => { setLoading(true); await emailRegister(name, email, password); setLoading(false); navigation.replace('Dashboard'); }} /></Card></KeyboardAvoidingView></Screen>;
}
