import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { VendoControlScreen } from '../screens/VendoControlScreen';
import { RomersVendoScreen } from '../screens/RomersVendoScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { WifiSetupScreen } from '../screens/WifiSetupScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="RomersVendo" component={RomersVendoScreen} />
        <Stack.Screen name="VendoControl" component={VendoControlScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="WifiSetup" component={WifiSetupScreen} />
        <Stack.Screen name="Analytics" component={AnalyticsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
