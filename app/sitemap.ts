import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: 'https://linhacash.com.br',
      lastModified,
    },
    {
      url: 'https://linhacash.com.br/termos',
      lastModified,
    },
    {
      url: 'https://linhacash.com.br/privacidade',
      lastModified,
    },
  ];
}
