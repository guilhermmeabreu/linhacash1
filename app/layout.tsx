import type { Metadata } from 'next';
import './globals.css';

const homeSeoDescription =
  'LinhaCash é uma plataforma brasileira de análise de dados para props da NBA, com estatísticas avançadas, tendências e matchups em tempo real.';

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'LinhaCash',
  url: 'https://linhacash.com.br',
  logo: 'https://linhacash.com.br/favicon.ico',
  description: homeSeoDescription,
};

export const metadata: Metadata = {
  title: {
    default: 'LinhaCash | Análise para NBA',
    template: '%s | LinhaCash',
  },
  description: homeSeoDescription,
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
    description: homeSeoDescription,
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
      { url: '/favicon.ico', sizes: 'any' },
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd).replace(/</g, '\\u003c'),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
