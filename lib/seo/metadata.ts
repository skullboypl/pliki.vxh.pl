import type { Metadata } from 'next';
import type { SeoPage } from '@/lib/seo/pages';
import { getSlug } from '@/lib/seo/pages';
import { APP_ICONS, OG_IMAGE } from '@/lib/seo/appMeta';
import { SITE_NAME, SITE_URL, type SeoLang, hubUrl, pageUrl } from '@/lib/seo/site';

function sharedSocial(title: string, description: string, url: string) {
  return {
    url,
    siteName: SITE_NAME,
    title,
    description,
    images: [
      {
        url: OG_IMAGE.url,
        width: OG_IMAGE.width,
        height: OG_IMAGE.height,
        alt: title,
        type: OG_IMAGE.type,
      },
    ],
  };
}

export function buildPageMetadata(page: SeoPage, lang: SeoLang): Metadata {
  const slug = getSlug(page, lang);
  const url = pageUrl(lang, slug);
  const title = page.title[lang];
  const description = page.description[lang];
  const social = sharedSocial(title, description, url);

  return {
    title,
    description,
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
      ...social,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [OG_IMAGE.url],
    },
    icons: APP_ICONS,
    robots: { index: true, follow: true },
  };
}

export function buildHubMetadata(lang: SeoLang, title: string, description: string): Metadata {
  const url = hubUrl(lang);
  const social = sharedSocial(title, description, url);

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
      ...social,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [OG_IMAGE.url],
    },
    icons: APP_ICONS,
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
