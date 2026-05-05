import { AuthScreen } from '@/components/auth-screen';

export default function RegisterScreen() {
  return (
    <AuthScreen
      title="Create Account"
      subtitle="Sign up to get started"
      fields={['Full Name', 'Email', 'Password', 'Confirm Password']}
      helper="Use 8+ characters for best security"
      primaryLabel="Register"
      footerLead="Already have an account?"
      footerAction="Login"
      footerHref="/login"
    />
  );
}
