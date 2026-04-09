import { Suspense } from 'react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { LoginForm } from '@/components/auth/auth-forms';

function LoginFallback() {
  return <p className="lc-auth-help">Carregando autenticação...</p>;
}

export default function LoginPage() {
  return (
    <AuthLayout title="Acesse sua conta" subtitle="Entre para ver os jogos, jogadores e métricas do dia.">
      <Suspense fallback={<LoginFallback />}>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
