import { AuthLayout } from '@/components/auth/auth-layout';
import { ResetPasswordForm } from '@/components/auth/auth-forms';

export default function ResetPasswordPage() {
  return (
    <AuthLayout title="Defina sua nova senha" subtitle="Finalize sua recuperação criando uma senha forte para sua conta.">
      <ResetPasswordForm />
    </AuthLayout>
  );
}
