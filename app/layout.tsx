import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LinhaCash',
  description: 'Análise de props da NBA',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

const themeBootScript = `(() => { try { const saved = localStorage.getItem('theme'); const theme = saved === 'light' ? 'light' : 'dark'; const root = document.documentElement; root.classList.remove('light', 'dark'); root.classList.add(theme); root.dataset.theme = theme; } catch (_) { document.documentElement.classList.add('dark'); document.documentElement.dataset.theme = 'dark'; } })();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}