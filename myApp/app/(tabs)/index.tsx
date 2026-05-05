import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const fieldData = {
  login: ['Email', 'Password'],
  register: ['Full Name', 'Email', 'Password', 'Confirm Password'],
};

function ChipWifiIcon() {
  return (
    <View style={styles.iconWrap}>
      <View style={styles.iconGradient}>
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
    <View style={styles.input}>
      <Text style={styles.placeholder}>{label}</Text>
    </View>
  );
}

function AuthFrame({
  title,
  subtitle,
  fields,
  primaryCta,
  footerLead,
  footerAction,
  helper,
}: {
  title: string;
  subtitle: string;
  fields: string[];
  primaryCta: string;
  footerLead: string;
  footerAction: string;
  helper: string;
}) {
  return (
    <View style={styles.frame}>
      <ChipWifiIcon />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <View style={styles.formSection}>
        {fields.map((field) => (
          <InputField key={field} label={field} />
        ))}

        <Text style={styles.helperText}>{helper}</Text>

        <View style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>{primaryCta}</Text>
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerLabel}>OR</Text>
          <View style={styles.divider} />
        </View>

        <View style={styles.googleBtn}>
          <View style={styles.googleDot} />
          <Text style={styles.googleBtnText}>Continue with Google</Text>
        </View>
      </View>

      <Text style={styles.footerText}>
        {footerLead} <Text style={styles.footerAction}>{footerAction}</Text>
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <AuthFrame
          title="Welcome Back"
          subtitle="Sign in to continue"
          fields={fieldData.login}
          primaryCta="Login"
          helper="Forgot Password?"
          footerLead="Don't have an account?"
          footerAction="Sign Up"
        />

        <AuthFrame
          title="Create Account"
          subtitle="Sign up to get started"
          fields={fieldData.register}
          primaryCta="Register"
          helper="Use 8+ characters for best security"
          footerLead="Already have an account?"
          footerAction="Login"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 20,
  },
  frame: {
    minHeight: 780,
    borderRadius: 24,
    backgroundColor: '#090909',
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 20,
    paddingVertical: 28,
    justifyContent: 'center',
    shadowColor: '#3B82F6',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: 18,
  },
  iconGradient: {
    width: 72,
    height: 72,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
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
  chipCore: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: '#60A5FA',
  },
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
  wifiDot: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#7DD3FC',
    top: 2,
  },
  title: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#A1A1AA',
    textAlign: 'center',
    fontSize: 15,
    marginBottom: 24,
  },
  formSection: {
    gap: 14,
  },
  input: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  placeholder: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  helperText: {
    color: '#D4D4D8',
    fontSize: 13,
    textAlign: 'right',
  },
  primaryBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  primaryBtnText: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 16,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 2,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#3F3F46',
  },
  dividerLabel: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  googleBtn: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#3F3F46',
    backgroundColor: '#161616',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  googleDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3B82F6',
  },
  googleBtnText: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '600',
  },
  footerText: {
    textAlign: 'center',
    color: '#A1A1AA',
    marginTop: 22,
    fontSize: 14,
  },
  footerAction: {
    color: '#60A5FA',
    fontWeight: '700',
  },
});
