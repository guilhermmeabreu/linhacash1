import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'LinhaCash | Análise para NBA',
    template: '%s | LinhaCash',
  },
  description: 'Plataforma de análise avançada para NBA com dados de props, tendências e desempenho.',
  keywords: [
    'NBA',
    'props NBA',
    'análise NBA',
    'estatísticas NBA',
    'tendências NBA',
    'desempenho jogadores NBA',
    'apostas esportivas NBA',
    'player props',
    'dados avançados NBA',
    'matchups NBA',
  ],
  openGraph: {
    title: 'LinhaCash | Análise para NBA',
    description: 'Dados avançados de NBA para análise de props e desempenho.',
    url: 'https://linhacash.com.br',
    siteName: 'LinhaCash',
    images: [
      {
        url: '/og-image.png',
      },
    ],
    locale: 'pt_BR',
    type: 'website',
  },
  verification: {
    google: 'Blk_U52ESbPN6YqttyCz5GNnGAlWc8wVkKbDw1Lmo-M',
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'LinhaCash',
    statusBarStyle: 'default',
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
