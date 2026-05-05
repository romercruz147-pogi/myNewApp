import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AuthScreen } from '@/components/auth-screen';
import { loginWithGoogle, subscribeToAuthState } from '@/lib/auth';

export default function LoginScreen() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => subscribeToAuthState((user) => {
    if (user) router.replace('/dashboard');
  }), [router]);

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
      subtitle="Google Sign-In only • secure Firebase auth"
      fields={[]}
      values={{}}
      onChange={() => {}}
      helper={loading ? 'Signing in…' : 'Use your Google account to continue'}
      primaryLabel="Continue"
      onPrimaryPress={onGoogleLogin}
      onGooglePress={onGoogleLogin}
      footerLead="Need access?"
      footerAction="Contact admin"
      footerHref="/register"
      error={error}
    />
  );
}
