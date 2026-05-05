import { AuthScreen } from '@/components/auth-screen';

export default function LoginScreen() {
  return (
    <AuthScreen
      title="Welcome Back"
      subtitle="Sign in to continue"
      fields={['Email', 'Password']}
      helper="Forgot Password?"
      primaryLabel="Login"
      footerLead="Don't have an account?"
      footerAction="Sign Up"
      footerHref="/register"
    />
  );
}
