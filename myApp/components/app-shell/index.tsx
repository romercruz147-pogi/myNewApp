import { usePathname, useRouter } from 'expo-router';
import { logoutUser } from '@/lib/auth';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { palette } from '@/components/theme';

const nav = [
  { href: '/dashboard' as const, label: 'Dashboard' },
  { href: '/devices' as const, label: 'Devices' },
  { href: '/secure-connection' as const, label: 'Secure Connection' },
  { href: '/analytics' as const, label: 'Analytics' },
  { href: '/settings' as const, label: 'Settings' },
  { href: '/romers-vendo' as const, label: 'Romers Vendo' },
];

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const desktop = width >= 900;
  const drawerWidth = Math.min(Math.max(width * 0.78, 260), 340);
  const [isDrawerOpen, setIsDrawerOpen] = useState(desktop);
  const slideAnim = useRef(new Animated.Value(desktop ? 0 : -drawerWidth)).current;
  const overlayAnim = useRef(new Animated.Value(desktop ? 0 : 0)).current;

  useEffect(() => {
    if (desktop) {
      setIsDrawerOpen(true);
      slideAnim.setValue(0);
      overlayAnim.setValue(0);
    } else {
      setIsDrawerOpen(false);
      slideAnim.setValue(-drawerWidth);
      overlayAnim.setValue(0);
    }
  }, [desktop, drawerWidth, overlayAnim, slideAnim]);

  const openDrawer = () => {
    if (desktop) return;
    setIsDrawerOpen(true);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  };

  const closeDrawer = () => {
    if (desktop) return;
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: -drawerWidth, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(() => setIsDrawerOpen(false));
  };

  const navigateAndClose = (href: (typeof nav)[number]['href']) => {
    router.push(href);
    closeDrawer();
  };

  return (
    <View style={styles.root}>
      {!desktop && (
        <View style={styles.headerRow}>
          <Pressable style={styles.menuButton} onPress={openDrawer}>
            <Text style={styles.menuIcon}>☰</Text>
          </Pressable>
          <Text style={styles.title}>{title}</Text>
        </View>
      )}

      {!desktop && isDrawerOpen && (
        <TouchableWithoutFeedback onPress={closeDrawer}>
          <Animated.View style={[styles.overlay, { opacity: overlayAnim }]} />
        </TouchableWithoutFeedback>
      )}

      <Animated.View
        style={[
          styles.sidebar,
          desktop ? styles.sidebarDesktop : styles.sidebarMobile,
          !desktop && { width: drawerWidth, transform: [{ translateX: slideAnim }] },
        ]}>
        {!desktop && (
          <Pressable style={styles.closeButton} onPress={closeDrawer}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        )}
        {nav.map((item) => (
          <Pressable key={item.href} onPress={() => navigateAndClose(item.href)}>
            <Text style={[styles.navItem, pathname === item.href && styles.navItemActive]}>{item.label}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={async () => {
            await logoutUser();
            closeDrawer();
            router.replace('/login');
          }}>
          <Text style={styles.logout}>Logout</Text>
        </Pressable>
      </Animated.View>

      <View style={[styles.content, !desktop && styles.mobileContent]}>
        {desktop && <Text style={styles.title}>{title}</Text>}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg, flexDirection: 'row' },
  headerRow: { position: 'absolute', top: 18, left: 12, right: 12, zIndex: 4, flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuButton: { backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: palette.border, paddingVertical: 8, paddingHorizontal: 11, borderRadius: 12 },
  menuIcon: { color: palette.text, fontSize: 18, fontWeight: '700' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 2 },
  sidebar: { backgroundColor: '#0A0A0A', borderRightWidth: 1, borderColor: palette.border, padding: 16, gap: 12, zIndex: 3 },
  sidebarDesktop: { width: 240 },
  sidebarMobile: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  closeButton: { alignSelf: 'flex-end', padding: 6 },
  closeText: { color: palette.text, fontSize: 18 },
  navItem: { color: palette.muted, padding: 12, borderRadius: 12, backgroundColor: '#141414' },
  navItemActive: { color: palette.text, backgroundColor: '#1D4ED8' },
  logout: { color: '#fca5a5', marginTop: 16, padding: 12 },
  content: { flex: 1, padding: 20, gap: 16 },
  mobileContent: { paddingTop: 76 },
  title: { color: palette.text, fontSize: 28, fontWeight: '700' },
});
