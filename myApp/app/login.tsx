import { useRouter } from 'expo-router';
import { useState } from 'react';
import { AuthScreen } from '@/components/auth-screen';
import { loginUser, loginWithGoogle } from '@/lib/auth';

export default function LoginScreen() {
  const router = useRouter();
  const [values, setValues] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const onLogin = async () => {
    const res = await loginUser(values.email, values.password);
    if (!res.ok) return setError(res.message ?? 'Request failed.');
    setError('');
    router.replace('/dashboard');
  };


  const onGoogleLogin = async () => {
    const res = await loginWithGoogle();
    if (!res.ok) return setError(res.message ?? 'Google login failed.');
    setError('');
    router.replace('/dashboard');
  };
  return (
    <AuthScreen
      title="Welcome Back"
      subtitle="Sign in to continue"
      fields={[{ key: 'email', label: 'Email' }, { key: 'password', label: 'Password', secure: true }]}
      values={values}
      onChange={(key, value) => setValues((s) => ({ ...s, [key]: value }))}
      helper="Forgot Password?"
      primaryLabel="Login"
      onPrimaryPress={onLogin}
      onGooglePress={onGoogleLogin}
      footerLead="Don't have an account?"
      footerAction="Sign Up"
      footerHref="/register"
      error={error}
    />
  );
}
