import React from 'react';
import { Button } from 'react-native';
import { Screen } from '../components/Screen';
import { logout } from '../services/authService';
export function SettingsScreen({ navigation }: any) { return <Screen><Button title='Logout' onPress={async () => { await logout(); navigation.replace('Login'); }} /></Screen>; }
