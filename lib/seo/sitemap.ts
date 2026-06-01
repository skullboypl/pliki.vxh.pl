import type { MetadataRoute } from 'next';
import { SEO_PAGES, getSlug } from '@/lib/seo/pages';
import { reviewsUrl } from '@/lib/seo/reviews';
import { SITE_URL, hubUrl, type SeoLang } from '@/lib/seo/site';

const LANGS: SeoLang[] = ['pl', 'en'];

function languageAlternates(paths: Record<SeoLang, string>) {
  return {
    languages: {
      pl: `${SITE_URL}${paths.pl}`,
      en: `${SITE_URL}${paths.en}`,
      'x-default': `${SITE_URL}${paths.pl}`,
    },
  };
}

export function buildSitemapEntries(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
      alternates: languageAlternates({ pl: '/', en: '/' }),
    },
  ];

  for (const lang of LANGS) {
    entries.push({
      url: hubUrl(lang),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
      alternates: languageAlternates({ pl: '/pl', en: '/en' }),
    });
  }

  const reviewPaths = { pl: reviewsUrl('pl'), en: reviewsUrl('en') } as const;
  for (const lang of LANGS) {
    entries.push({
      url: `${SITE_URL}${reviewPaths[lang]}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.85,
      alternates: languageAlternates(reviewPaths),
    });
  }

  for (const page of SEO_PAGES) {
    const articlePaths = {
      pl: `/pl/${page.plSlug}`,
      en: `/en/${page.enSlug}`,
    };
    for (const lang of LANGS) {
      entries.push({
        url: `${SITE_URL}/${lang}/${getSlug(page, lang)}`,
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.7,
        alternates: languageAlternates(articlePaths),
      });
    }
  }

  return entries;
}
