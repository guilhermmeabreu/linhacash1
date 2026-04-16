'use client';

import { useRouter } from 'next/navigation';
import { PropsWithChildren, useEffect, useState } from 'react';
import { ensureValidAccessToken } from '@/lib/auth/client-session';

export function AppAuthBootstrap({ children }: PropsWithChildren) {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let canceled = false;

    async function bootstrapAuth() {
      const token = await ensureValidAccessToken();
      if (canceled) return;

      if (!token) {
        setAuthenticated(false);
        setAuthReady(true);
        router.replace('/login');
        return;
      }

      setAuthenticated(true);
      setAuthReady(true);
    }

    void bootstrapAuth();

    return () => {
      canceled = true;
    };
  }, [router]);

  if (!authReady) {
    return null;
  }

  if (!authenticated) {
    return null;
  }

  return <>{children}</>;
}
