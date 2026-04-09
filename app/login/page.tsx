import { AuthLayout } from '@/components/auth/auth-layout';
import { LoginForm } from '@/components/auth/auth-forms';

export default function LoginPage() {
  return (
    <AuthLayout title="Acesse sua conta" subtitle="Entre para ver os jogos, jogadores e métricas do dia.">
      <LoginForm />
    </AuthLayout>
  );
}
