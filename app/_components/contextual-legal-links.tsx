'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface ContextualLegalLinksProps {
  className?: string;
  includeSupport?: boolean;
}

export function ContextualLegalLinks({ className, includeSupport = false }: ContextualLegalLinksProps) {
  const pathname = usePathname();
  const isDashboardPath = pathname.startsWith('/dashboard') || pathname.startsWith('/app');
  const isDashboardAlias = pathname.startsWith('/dashboard');

  const termsHref = isDashboardAlias ? '/dashboard/termos' : isDashboardPath ? '/app/termos' : '/termos';
  const privacyHref = isDashboardAlias ? '/dashboard/privacidade' : isDashboardPath ? '/app/privacidade' : '/privacidade';

  return (
    <div className={className}>
      {includeSupport ? <a href="mailto:suporte@linhacash.com.br">suporte@linhacash.com.br</a> : null}
      <Link href={termsHref}>Termos</Link>
      <Link href={privacyHref}>Privacidade</Link>
    </div>
  );
}
