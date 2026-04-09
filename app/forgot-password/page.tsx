import { AuthLayout } from '@/components/auth/auth-layout';
import { ForgotPasswordForm } from '@/components/auth/auth-forms';

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthLayout title="Recuperar acesso" subtitle="Informe seu email para receber o link de redefinição de senha.">
      <ForgotPasswordForm defaultEmail={params.email ?? ''} />
    </AuthLayout>
  );
}
