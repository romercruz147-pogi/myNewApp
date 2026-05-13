import React, { PropsWithChildren } from 'react';
import { AppShell } from './layout/AppShell';

export const Screen = ({ children }: PropsWithChildren) => <AppShell>{children}</AppShell>;
