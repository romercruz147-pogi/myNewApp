import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { colors } from '../theme/colors';
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
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size='large' color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? (
        <Stack.Navigator
          screenOptions={{ headerShown: false }}
          initialRouteName='Dashboard'
        >
          <Stack.Screen name='Dashboard' component={DashboardScreen} />
          <Stack.Screen name='RomersVendo' component={RomersVendoScreen} />
          <Stack.Screen name='VendoControl' component={VendoControlScreen} />
          <Stack.Screen name='Settings' component={SettingsScreen} />
          <Stack.Screen name='WifiSetup' component={WifiSetupScreen} />
          <Stack.Screen name='Analytics' component={AnalyticsScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator
          screenOptions={{ headerShown: false }}
          initialRouteName='Login'
        >
          <Stack.Screen name='Login' component={LoginScreen} />
          <Stack.Screen name='Register' component={RegisterScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
