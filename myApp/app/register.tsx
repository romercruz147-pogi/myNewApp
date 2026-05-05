import { useRouter } from 'expo-router';
import { FirebaseError } from 'firebase/app';
import { useEffect, useState } from 'react';
import { AuthScreen } from '@/components/auth-screen';
import { registerWithEmail, subscribeToAuthState } from '@/lib/auth';

function mapAuthError(error: unknown) {
  if (!(error instanceof FirebaseError)) return 'Registration failed. Please try again.';
  if (error.code === 'auth/invalid-email') return 'Please enter a valid email address.';
  if (error.code === 'auth/email-already-in-use') return 'This email is already registered.';
  if (error.code === 'auth/weak-password') return 'Password is too weak.';
  return 'Unable to register right now.';
}

export default function RegisterScreen() {
  const router = useRouter();
  const [values, setValues] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => subscribeToAuthState((user) => {
    if (user) router.replace('/dashboard');
  }), [router]);

  const onChange = (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value }));

  const onRegister = async () => {
    if (!values.name.trim() || !values.email.trim() || !values.password || !values.confirmPassword) return setError('All fields are required.');
    if (values.password.length < 6) return setError('Password must be at least 6 characters.');
    if (values.password !== values.confirmPassword) return setError('Passwords do not match.');
    setLoading(true);
    setError('');
    try {
      await registerWithEmail(values.name.trim(), values.email.trim(), values.password);
      router.replace('/dashboard');
    } catch (e) {
      setError(mapAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="Create Account"
      subtitle="Register to control your ESP32 devices"
      fields={[
        { key: 'name', label: 'Full Name' },
        { key: 'email', label: 'Email' },
        { key: 'password', label: 'Password', secure: true },
        { key: 'confirmPassword', label: 'Confirm Password', secure: true },
      ]}
      values={values}
      onChange={onChange}
      helper={loading ? 'Creating account…' : 'Use email and password to register'}
      primaryLabel={loading ? 'Loading…' : 'Register'}
      onPrimaryPress={onRegister}
      footerLead="Already have an account?"
      footerAction="Login"
      footerHref="/login"
      error={error}
      hideGoogle
    />
  );
}
