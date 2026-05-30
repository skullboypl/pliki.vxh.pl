import type { MetadataRoute } from 'next';
import { SEO_PAGES, getSlug } from '@/lib/seo/pages';
import { SITE_URL, type SeoLang } from '@/lib/seo/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/pl`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/en`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
  ];

  for (const page of SEO_PAGES) {
    for (const lang of ['pl', 'en'] as SeoLang[]) {
      entries.push({
        url: `${SITE_URL}/${lang}/${getSlug(page, lang)}`,
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.7,
        alternates: {
          languages: {
            pl: `${SITE_URL}/pl/${page.plSlug}`,
            en: `${SITE_URL}/en/${page.enSlug}`,
          },
        },
      });
    }
  }

  return entries;
}
