import { Suspense } from 'react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { ResetPasswordForm } from '@/components/auth/auth-forms';

function ResetPasswordFallback() {
  return <p className="lc-auth-help">Carregando recuperação...</p>;
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout title="Defina sua nova senha" subtitle="Finalize sua recuperação criando uma senha forte para sua conta.">
      <Suspense fallback={<ResetPasswordFallback />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthLayout>
  );
}
