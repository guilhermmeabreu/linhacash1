import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LinhaCash',
    short_name: 'LinhaCash',
    description: 'Plataforma de análise avançada para NBA com dados de props e tendências.',
    start_url: '/',
    display: 'standalone',
    background_color: '#020202',
    theme_color: '#22c55e',
    lang: 'pt-BR',
    icons: [
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/favicon-16x16.png',
        sizes: '16x16',
        type: 'image/png',
      },
    ],
  };
}
