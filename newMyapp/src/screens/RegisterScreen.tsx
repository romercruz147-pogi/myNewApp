import React, { useState } from 'react';
import { Button, TextInput } from 'react-native';
import { Screen } from '../components/Screen';
import { emailRegister } from '../services/authService';

export function RegisterScreen({ navigation }: any) {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  return <Screen>
    <TextInput placeholder='Name' value={name} onChangeText={setName} />
    <TextInput placeholder='Email' value={email} onChangeText={setEmail} />
    <TextInput placeholder='Password' secureTextEntry value={password} onChangeText={setPassword} />
    <Button title='Create Account' onPress={async () => { await emailRegister(name, email, password); navigation.replace('Dashboard'); }} />
  </Screen>;
}
