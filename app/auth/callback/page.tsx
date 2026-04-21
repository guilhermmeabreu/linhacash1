'use client';

import { useEffect } from 'react';
import { captureAuthSessionFromUrl, persistAuthSession } from '@/lib/auth/client-session';

export default function AuthCallbackPage() {
  useEffect(() => {
    let canceled = false;

    async function resolveCallback() {
      const currentUrl = new URL(window.location.href);
      const params = currentUrl.searchParams;
      const hashParams = new URLSearchParams(currentUrl.hash.replace(/^#/, ''));
      const { flow } = captureAuthSessionFromUrl(currentUrl);

      const rawError = hashParams.get('error_description')
        || params.get('error_description')
        || hashParams.get('error')
        || params.get('error');
      const cleanError = rawError ? decodeURIComponent(rawError).trim() : '';

      if (cleanError) {
        const target = `/login?auth_status=error&auth_message=${encodeURIComponent(cleanError)}`;
        window.location.replace(target);
        return;
      }

      const oauthCode = params.get('code')?.trim();
      if (oauthCode) {
        const response = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'exchange_code', code: oauthCode }),
        });
        const payload = await response.json().catch(() => ({})) as {
          token?: string;
          refreshToken?: string;
          expiresAt?: number;
          tokenType?: string;
          error?: string;
        };
        if (!response.ok || !payload?.token) {
          const message = payload?.error || 'Não foi possível concluir o login com Google.';
          window.location.replace(`/login?auth_status=error&auth_message=${encodeURIComponent(message)}`);
          return;
        }
        if (!canceled) {
          persistAuthSession({
            accessToken: payload.token,
            refreshToken: payload.refreshToken,
            expiresAt: payload.expiresAt,
            tokenType: payload.tokenType,
          });
        }
      }

      if (flow === 'recovery') {
        const recoveryParams = new URLSearchParams(params.toString());
        ['access_token', 'refresh_token', 'token_type', 'expires_in', 'expires_at', 'code', 'error', 'error_description', 'type', 'oauth', 'status'].forEach((key) => {
          recoveryParams.delete(key);
        });
        const nextQuery = recoveryParams.toString();
        const target = `/reset-password${nextQuery ? `?${nextQuery}` : ''}${window.location.hash || ''}`;
        window.location.replace(target);
        return;
      }

      if (flow === 'email_change') {
        window.location.replace('/login?auth_status=success&auth_flow=email_change');
        return;
      }

      if (flow === 'password_change') {
        window.location.replace('/login?auth_status=success&auth_flow=password_change');
        return;
      }

      if (flow === 'signup_confirmation' || flow === 'signup') {
        window.location.replace('/login?auth_status=success&auth_flow=signup_confirmation');
        return;
      }

      window.location.replace('/app');
    }

    void resolveCallback();
    return () => {
      canceled = true;
    };
  }, []);

  return null;
}
