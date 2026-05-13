import React from 'react';
import { Text } from 'react-native';
import { theme } from '../../theme';

export const SectionHeader = ({ title }: any) => <Text style={{ color: theme.colors.text, ...theme.typography.h2, marginBottom: theme.spacing.md }}>{title}</Text>;
