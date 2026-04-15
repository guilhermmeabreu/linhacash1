'use client';

import { useEffect } from 'react';

export default function AuthCallbackPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = hashParams.get('access_token') || params.get('access_token');
    if (accessToken) {
      window.localStorage.setItem('lc_token', accessToken);
    }

    const flow = (params.get('auth_flow') || params.get('type') || '').toLowerCase();
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

    const target = '/app';
    window.location.replace(target);
  }, []);

  return null;
}
