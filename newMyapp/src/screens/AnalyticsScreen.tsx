import React from 'react';
import { Text } from 'react-native';
import { Screen } from '../components/Screen';
import { TopBar } from '../components/layout/TopBar';
import { Card } from '../components/ui/Card';

export function AnalyticsScreen() { return <Screen><TopBar title='Analytics' subtitle='Machine insights' /><Card><Text style={{ color: '#A6B3C8' }}>Analytics coming soon.</Text></Card></Screen>; }
