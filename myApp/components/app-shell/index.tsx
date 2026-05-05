import { Link, usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ReactNode } from 'react';
import { palette } from '@/components/theme';

const nav = [
  { href: '/dashboard' as const, label: 'Dashboard' },
  { href: '/devices' as const, label: 'Devices' },
  { href: '/analytics' as const, label: 'Analytics' },
  { href: '/settings' as const, label: 'Settings' },
];

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const desktop = width >= 900;

  return (
    <View style={styles.root}>
      <View style={[styles.sidebar, desktop ? styles.sidebarDesktop : styles.sidebarMobile]}>
        {nav.map((item) => (
          <Link key={item.href} href={item.href} style={[styles.navItem, pathname === item.href && styles.navItemActive]}>
            {item.label}
          </Link>
        ))}
        <Pressable onPress={() => router.replace('/login')}><Text style={styles.logout}>Logout</Text></Pressable>
      </View>
      <View style={styles.content}><Text style={styles.title}>{title}</Text>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg, flexDirection: 'row' },
  sidebar: { backgroundColor: '#0A0A0A', borderRightWidth: 1, borderColor: palette.border, padding: 16, gap: 12 },
  sidebarDesktop: { width: 240 },
  sidebarMobile: { width: 120 },
  navItem: { color: palette.muted, padding: 12, borderRadius: 12, backgroundColor: '#141414' },
  navItemActive: { color: palette.text, backgroundColor: '#1D4ED8' },
  logout: { color: '#fca5a5', marginTop: 16, padding: 12 },
  content: { flex: 1, padding: 20, gap: 16 },
  title: { color: palette.text, fontSize: 28, fontWeight: '700' },
});
