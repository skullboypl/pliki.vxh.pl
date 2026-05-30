import type { Metadata } from 'next';
import type { SeoPage } from '@/lib/seo/pages';
import { getAlternateSlug, getSlug } from '@/lib/seo/pages';
import { SITE_NAME, SITE_URL, type SeoLang, hubUrl, pageUrl } from '@/lib/seo/site';

export function buildPageMetadata(page: SeoPage, lang: SeoLang): Metadata {
  const slug = getSlug(page, lang);
  const url = pageUrl(lang, slug);

  return {
    title: page.title[lang],
    description: page.description[lang],
    keywords: page.keywords[lang],
    alternates: {
      canonical: url,
      languages: {
        pl: pageUrl('pl', page.plSlug),
        en: pageUrl('en', page.enSlug),
        'x-default': pageUrl('pl', page.plSlug),
      },
    },
    openGraph: {
      type: 'article',
      locale: lang === 'pl' ? 'pl_PL' : 'en_US',
      url,
      siteName: SITE_NAME,
      title: page.title[lang],
      description: page.description[lang],
    },
    twitter: {
      card: 'summary',
      title: page.title[lang],
      description: page.description[lang],
    },
    robots: { index: true, follow: true },
  };
}

export function buildHubMetadata(lang: SeoLang, title: string, description: string): Metadata {
  const url = hubUrl(lang);

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: {
        pl: hubUrl('pl'),
        en: hubUrl('en'),
        'x-default': hubUrl('pl'),
      },
    },
    openGraph: {
      type: 'website',
      locale: lang === 'pl' ? 'pl_PL' : 'en_US',
      url,
      siteName: SITE_NAME,
      title,
      description,
    },
    twitter: { card: 'summary', title, description },
    robots: { index: true, follow: true },
  };
}

export function jsonLdWebPage(lang: SeoLang, title: string, description: string, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url,
    inLanguage: lang === 'pl' ? 'pl-PL' : 'en-US',
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}
