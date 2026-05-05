import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { palette } from './theme';

type Field = { key: string; label: string; secure?: boolean };

type AuthScreenProps = {
  title: string;
  subtitle: string;
  fields: Field[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  helper: string;
  primaryLabel: string;
  onPrimaryPress: () => void;
  footerLead: string;
  footerAction: string;
  footerHref: '/login' | '/register';
  error?: string;
};

export function AuthScreen(props: AuthScreenProps) {
  const { width, height } = useWindowDimensions();
  const frameWidth = Math.min(390, width);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={[styles.container, { minHeight: height }]}>
        <View style={[styles.frame, { width: frameWidth }]}> 
          <Text style={styles.icon}>📶</Text>
          <Text style={styles.title}>{props.title}</Text>
          <Text style={styles.subtitle}>{props.subtitle}</Text>

          <View style={styles.form}>
            {props.fields.map((f) => (
              <TextInput
                key={f.key}
                placeholder={f.label}
                placeholderTextColor={palette.muted}
                value={props.values[f.key] ?? ''}
                onChangeText={(v) => props.onChange(f.key, v)}
                secureTextEntry={f.secure}
                style={styles.input}
              />
            ))}
            <Text style={styles.helper}>{props.helper}</Text>
            {!!props.error && <Text style={styles.error}>{props.error}</Text>}
            <Pressable style={styles.primary} onPress={props.onPrimaryPress}>
              <Text style={styles.primaryText}>{props.primaryLabel}</Text>
            </Pressable>
            <View style={styles.orRow}><View style={styles.line} /><Text style={styles.or}>OR</Text><View style={styles.line} /></View>
            <Pressable style={styles.secondary}><Text style={styles.secondaryText}>Continue with Google</Text></Pressable>
          </View>

          <Text style={styles.footer}>{props.footerLead} <Link href={props.footerHref} style={styles.link}>{props.footerAction}</Link></Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  frame: { padding: 20, borderRadius: 24, backgroundColor: palette.bg },
  icon: { color: palette.accent, textAlign: 'center', fontSize: 42, marginBottom: 12 },
  title: { color: palette.text, textAlign: 'center', fontSize: 30, fontWeight: '700' },
  subtitle: { color: palette.muted, textAlign: 'center', marginBottom: 22 },
  form: { gap: 12 },
  input: { backgroundColor: palette.panel2, color: palette.text, borderRadius: 18, paddingHorizontal: 16, height: 54, borderColor: palette.border, borderWidth: 1 },
  helper: { color: palette.muted, textAlign: 'right' },
  error: { color: '#f87171' },
  primary: { height: 54, borderRadius: 18, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  primaryText: { color: '#111827', fontWeight: '700' },
  orRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  line: { flex: 1, height: 1, backgroundColor: palette.border },
  or: { color: palette.muted, fontSize: 12 },
  secondary: { height: 54, borderRadius: 18, borderWidth: 1, borderColor: palette.border, justifyContent: 'center', alignItems: 'center' },
  secondaryText: { color: palette.text },
  footer: { color: palette.muted, textAlign: 'center', marginTop: 20 },
  link: { color: palette.accent, fontWeight: '700' },
});
