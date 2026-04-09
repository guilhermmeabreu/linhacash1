import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LinhaCash',
  description: 'Análise de props da NBA',
};

const themeBootScript = `(() => { try { const saved = localStorage.getItem('theme'); const theme = saved === 'light' ? 'light' : 'dark'; const root = document.documentElement; root.classList.add(theme); } catch (_) { document.documentElement.classList.add('dark'); } })();`;

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
