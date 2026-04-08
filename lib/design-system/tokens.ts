export const designTokens = {
  color: {
    background: '#000000',
    surface: '#0a0a0a',
    surfaceElevated: '#111111',
    text: '#ffffff',
    textMuted: '#888888',
    accent: '#22c55e',
    border: '#1f1f1f',
    borderStrong: '#2b2b2b',
  },
  spacing: {
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3rem',
  },
  radius: {
    none: '0',
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
  },
  typography: {
    display: '2rem',
    h1: '1.75rem',
    h2: '1.375rem',
    h3: '1.125rem',
    body: '0.95rem',
    label: '0.8rem',
    mono: '0.9rem',
  },
  shadow: {
    subtle: '0 8px 24px rgba(0, 0, 0, 0.28)',
  },
  zIndex: {
    base: 1,
    topbar: 30,
    sidebar: 35,
    overlay: 50,
  },
  transition: {
    fast: '120ms ease',
    base: '200ms ease',
  },
  container: {
    md: '48rem',
    lg: '64rem',
    xl: '80rem',
    content: '96rem',
  },
} as const;

export type DesignTokens = typeof designTokens;
