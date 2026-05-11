import React, { useState } from 'react';
import { Alert, Button, TextInput } from 'react-native';
import { Screen } from '../components/Screen';
import { emailLogin, loginWithGoogle } from '../services/authService';

export function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return <Screen>
    <TextInput placeholder='Email' value={email} onChangeText={setEmail} />
    <TextInput placeholder='Password' secureTextEntry value={password} onChangeText={setPassword} />
    <Button title='Login' onPress={async () => { try { await emailLogin(email, password); navigation.replace('Dashboard'); } catch (e: any) { Alert.alert(e.message); } }} />
    <Button title='Google Login' onPress={async () => { await loginWithGoogle(); navigation.replace('Dashboard'); }} />
    <Button title='Go Register' onPress={() => navigation.navigate('Register')} />
  </Screen>;
}
