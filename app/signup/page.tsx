import { AuthLayout } from '@/components/auth/auth-layout';
import { SignupForm } from '@/components/auth/auth-forms';

export default function SignupPage() {
  return (
    <AuthLayout title="Crie sua conta" subtitle="Comece no plano gratuito e evolua para o Pro quando quiser.">
      <SignupForm />
    </AuthLayout>
  );
}
