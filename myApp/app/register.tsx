import { useRouter } from 'expo-router';
import { useState } from 'react';
import { AuthScreen } from '@/components/auth-screen';
import { registerUser } from '@/lib/auth';

export default function RegisterScreen() {
  const router = useRouter();
  const [values, setValues] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');

  const onRegister = async () => {
    if (values.password !== values.confirm) return setError('Passwords do not match.');
    const res = await registerUser(values.name, values.email, values.password);
    if (!res.ok) return setError(res.message ?? 'Request failed.');
    setError('');
    router.replace('/login');
  };

  return (
    <AuthScreen
      title="Create Account"
      subtitle="Sign up to get started"
      fields={[{ key: 'name', label: 'Full Name' }, { key: 'email', label: 'Email' }, { key: 'password', label: 'Password', secure: true }, { key: 'confirm', label: 'Confirm Password', secure: true }]}
      values={values}
      onChange={(key, value) => setValues((s) => ({ ...s, [key]: value }))}
      helper="Use 8+ characters for best security"
      primaryLabel="Register"
      onPrimaryPress={onRegister}
      footerLead="Already have an account?"
      footerAction="Login"
      footerHref="/login"
      error={error}
    />
  );
}
