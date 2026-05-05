import { useRouter } from 'expo-router';
import { FirebaseError } from 'firebase/app';
import { useEffect, useState } from 'react';
import { AuthScreen } from '@/components/auth-screen';
import { loginWithEmail, loginWithGoogle, subscribeToAuthState } from '@/lib/auth';

function mapAuthError(error: unknown) {
  if (!(error instanceof FirebaseError)) return 'Login failed. Please try again.';
  if (error.code === 'auth/invalid-email') return 'Please enter a valid email address.';
  if (error.code === 'auth/user-not-found') return 'No user found with this email.';
  if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') return 'Incorrect password.';
  return 'Unable to login right now.';
}

export default function LoginScreen() {
  const router = useRouter();
  const [values, setValues] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => subscribeToAuthState((user) => {
    if (user) router.replace('/dashboard');
  }), [router]);

  const onChange = (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value }));

  const onEmailLogin = async () => {
    if (!values.email.trim() || !values.password.trim()) return setError('Email and password are required.');
    setLoading(true);
    setError('');
    try {
      await loginWithEmail(values.email.trim(), values.password);
      router.replace('/dashboard');
    } catch (e) {
      setError(mapAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  const onGoogleLogin = async () => {
    setLoading(true);
    const res = await loginWithGoogle();
    setLoading(false);
    if (!res.ok) return setError(res.message ?? 'Google login failed.');
    setError('');
    router.replace('/dashboard');
  };

  return (
    <AuthScreen
      title="Welcome Back"
      subtitle="Sign in to manage your IoT devices"
      fields={[
        { key: 'email', label: 'Email' },
        { key: 'password', label: 'Password', secure: true },
      ]}
      values={values}
      onChange={onChange}
      helper={loading ? 'Signing in…' : 'Enter your account details'}
      primaryLabel={loading ? 'Loading…' : 'Login'}
      onPrimaryPress={onEmailLogin}
      onGooglePress={onGoogleLogin}
      footerLead="Don’t have an account?"
      footerAction="Sign Up"
      footerHref="/register"
      error={error}
    />
  );
}
