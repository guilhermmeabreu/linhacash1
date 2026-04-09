'use client';

import { useEffect } from 'react';

export default function AuthCallbackPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flow = (params.get('auth_flow') || params.get('type') || '').toLowerCase();
    if (flow === 'recovery') {
      const target = `/reset-password${window.location.search || ''}${window.location.hash || ''}`;
      window.location.replace(target);
      return;
    }

    const target = `/app.html${window.location.search || ''}${window.location.hash || ''}`;
    window.location.replace(target);
  }, []);

  return null;
}
