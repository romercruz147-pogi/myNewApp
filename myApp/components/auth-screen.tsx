import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type AuthScreenProps = {
  title: string;
  subtitle: string;
  fields: string[];
  helper: string;
  primaryLabel: string;
  footerLead: string;
  footerAction: string;
  footerHref: '/login' | '/register';
};

function ChipWifiIcon() {
  return (
    <View style={styles.iconWrap}>
      <View style={styles.iconBackdrop}>
        <View style={styles.chipBody}>
          <View style={styles.chipCore} />
          <View style={styles.wifiArcLarge} />
          <View style={styles.wifiArcSmall} />
          <View style={styles.wifiDot} />
        </View>
      </View>
    </View>
  );
}

function InputField({ label }: { label: string }) {
  return (
    <View style={styles.inputField}>
      <Text style={styles.placeholder}>{label}</Text>
    </View>
  );
}

export function AuthScreen(props: AuthScreenProps) {
  const { width, height } = useWindowDimensions();

  const frameWidth = Math.min(width, 390);
  const horizontalPadding = width < 360 ? 16 : 20;
  const verticalPadding = height < 700 ? 20 : 28;
  const formGap = width < 360 ? 12 : 14;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          {
            minHeight: height,
            paddingHorizontal: Math.max((width - frameWidth) / 2, 0),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.phoneFrame,
            {
              width: frameWidth,
              minHeight: height,
              paddingHorizontal: horizontalPadding,
              paddingVertical: verticalPadding,
            },
          ]}>
          <ChipWifiIcon />
          <Text style={styles.title}>{props.title}</Text>
          <Text style={styles.subtitle}>{props.subtitle}</Text>

          <View style={[styles.formBlock, { gap: formGap }]}>
            {props.fields.map((field) => (
              <InputField key={field} label={field} />
            ))}

            <Text style={styles.helperText}>{props.helper}</Text>

            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{props.primaryLabel}</Text>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable style={styles.secondaryButton}>
              <View style={styles.googleDot} />
              <Text style={styles.secondaryButtonText}>Continue with Google</Text>
            </Pressable>
          </View>

          <Text style={styles.footer}>
            {props.footerLead}{' '}
            <Link href={props.footerHref} style={styles.footerAction}>
              {props.footerAction}
            </Link>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#000000' },
  scrollContainer: {
    flexGrow: 1,
  },
  phoneFrame: {
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  iconWrap: { alignItems: 'center', marginBottom: 18 },
  iconBackdrop: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  chipBody: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#60A5FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipCore: { width: 10, height: 10, borderRadius: 3, backgroundColor: '#60A5FA' },
  wifiArcLarge: {
    position: 'absolute',
    width: 27,
    height: 27,
    borderWidth: 2,
    borderColor: '#38BDF8',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderRadius: 16,
    top: -12,
  },
  wifiArcSmall: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderWidth: 2,
    borderColor: '#38BDF8',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderRadius: 10,
    top: -7,
  },
  wifiDot: { position: 'absolute', width: 5, height: 5, borderRadius: 3, backgroundColor: '#7DD3FC', top: 2 },
  title: { color: '#FFFFFF', textAlign: 'center', fontSize: 30, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#A1A1AA', textAlign: 'center', fontSize: 15, marginBottom: 24 },
  formBlock: { gap: 14 },
  inputField: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: '#1E1E1E',
  },
  placeholder: { color: '#A1A1AA', fontSize: 14 },
  helperText: { color: '#D4D4D8', fontSize: 13, textAlign: 'right' },
  primaryButton: {
    height: 54,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: { color: '#111827', fontWeight: '700', fontSize: 16 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#3F3F46' },
  dividerText: { color: '#A1A1AA', fontWeight: '600', fontSize: 12, letterSpacing: 1 },
  secondaryButton: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#3F3F46',
    backgroundColor: '#161616',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleDot: {
    position: 'absolute',
    left: 22,
    top: 21,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3B82F6',
  },
  secondaryButtonText: { color: '#E5E7EB', fontSize: 14, fontWeight: '600' },
  footer: { color: '#A1A1AA', textAlign: 'center', marginTop: 22, fontSize: 14 },
  footerAction: { color: '#3B82F6', fontWeight: '700' },
});
