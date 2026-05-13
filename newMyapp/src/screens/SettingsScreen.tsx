import React from 'react';
import { Screen } from '../components/Screen';
import { logout } from '../services/authService';
import { TopBar } from '../components/layout/TopBar';
import { Card } from '../components/ui/Card';
import { AppButton } from '../components/ui/Button';

export function SettingsScreen({ navigation }: any) { return <Screen><TopBar title='Settings' subtitle='Manage account' /><Card><AppButton title='Logout' variant='danger' onPress={async () => { await logout(); navigation.replace('Login'); }} /></Card></Screen>; }
