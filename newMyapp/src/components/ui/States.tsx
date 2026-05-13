import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { theme } from '../../theme';

export const LoadingState = ({ text = 'Loading...' }: any) => <View><ActivityIndicator color={theme.colors.primary} /><Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>{text}</Text></View>;
export const EmptyState = ({ text = 'No data found.' }: any) => <Text style={{ color: theme.colors.textMuted }}>{text}</Text>;
export const ErrorState = ({ text = 'Something went wrong.' }: any) => <Text style={{ color: theme.colors.danger }}>{text}</Text>;
