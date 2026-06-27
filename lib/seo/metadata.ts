import type { Metadata } from 'next';
import type { SeoPage } from '@/lib/seo/pages';
import { getSlug } from '@/lib/seo/pages';
import { formatMetaTitle, getHubSeoMeta, getPageSeoMeta } from '@/lib/seo/pageMeta';
import { APP_ICONS, OG_IMAGE } from '@/lib/seo/appMeta';
import { getReviewsAggregate, getReviewsCopy } from '@/lib/seo/reviews';
import { SITE_NAME, SITE_URL, type SeoLang, hubUrl, pageUrl } from '@/lib/seo/site';

const ROBOTS_GOOGLE = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    'max-image-preview': 'large' as const,
    'max-snippet': -1,
    'max-video-preview': -1,
  },
};

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

function baseMetadata(
  lang: SeoLang,
  title: string,
  description: string,
  url: string,
  keywords: string[],
  ogType: 'website' | 'article',
  alternates?: Metadata['alternates'],
): Metadata {
  const social = sharedSocial(title, description, url);

  return {
    metadataBase: new URL(SITE_URL),
    title: { absolute: formatMetaTitle(title, lang) },
    description,
    keywords,
    applicationName: SITE_NAME,
    authors: [{ name: SITE_NAME, url: SITE_URL }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    category: 'technology',
    alternates,
    openGraph: {
      type: ogType,
      locale: lang === 'pl' ? 'pl_PL' : 'en_US',
      alternateLocale: lang === 'pl' ? ['en_US'] : ['pl_PL'],
      ...social,
    },
    twitter: {
      card: 'summary_large_image',
      title: formatMetaTitle(title, lang),
      description,
      images: [OG_IMAGE.url],
    },
    icons: APP_ICONS,
    robots: ROBOTS_GOOGLE,
  };
}

export function buildPageMetadata(page: SeoPage, lang: SeoLang): Metadata {
  const slug = getSlug(page, lang);
  const url = pageUrl(lang, slug);
  const seo = getPageSeoMeta(page.id, lang);
  const keywords = [
    ...page.keywords[lang],
    'pliki.vxh.pl',
    lang === 'pl' ? 'transfer plików wifi' : 'wifi file transfer',
  ];

  return baseMetadata(lang, seo.title, seo.description, url, keywords, 'article', {
    canonical: url,
    languages: {
      pl: pageUrl('pl', page.plSlug),
      en: pageUrl('en', page.enSlug),
      'x-default': pageUrl('pl', page.plSlug),
    },
  });
}

export function buildHubMetadata(lang: SeoLang): Metadata {
  const seo = getHubSeoMeta(lang);
  const url = hubUrl(lang);
  const keywords =
    lang === 'pl'
      ? [
          'poradniki transfer plików',
          'wyślij plik wifi',
          'lan p2p',
          'pliki.vxh.pl',
          'przesyłanie plików bez aplikacji',
          'kamera lan obs',
        ]
      : [
          'file transfer guides',
          'send file wifi',
          'lan p2p',
          'pliki.vxh.pl',
          'local network file sharing',
          'camera lan obs',
        ];

  return baseMetadata(lang, seo.title, seo.description, url, keywords, 'website', {
    canonical: url,
    languages: {
      pl: hubUrl('pl'),
      en: hubUrl('en'),
      'x-default': hubUrl('pl'),
    },
  });
}

export function buildReviewsMetadata(lang: SeoLang): Metadata {
  const copy = getReviewsCopy(lang);
  const url = `${SITE_URL}${lang === 'pl' ? '/reviews' : '/en/reviews'}`;
  const keywords =
    lang === 'pl'
      ? [
          'opinie pliki.vxh.pl',
          'recenzje transfer plików',
          'wyślij plik wifi opinie',
          'lan file transfer',
        ]
      : [
          'pliki.vxh.pl reviews',
          'wifi file transfer reviews',
          'local file sharing feedback',
        ];

  return baseMetadata(lang, copy.metaTitle, copy.metaDescription, url, keywords, 'website', {
    canonical: url,
    languages: {
      pl: `${SITE_URL}/reviews`,
      en: `${SITE_URL}/en/reviews`,
      'x-default': `${SITE_URL}/reviews`,
    },
  });
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

export function jsonLdArticle(page: SeoPage, lang: SeoLang) {
  const slug = getSlug(page, lang);
  const url = pageUrl(lang, slug);
  const seo = getPageSeoMeta(page.id, lang);

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: page.h1[lang],
    description: seo.description,
    url,
    inLanguage: lang === 'pl' ? 'pl-PL' : 'en-US',
    author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
    mainEntityOfPage: url,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
  };
}

export function jsonLdBreadcrumb(
  lang: SeoLang,
  items: { name: string; url: string }[],
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function jsonLdReviews(lang: SeoLang) {
  const copy = getReviewsCopy(lang);
  const agg = getReviewsAggregate();
  const pageUrlFull = `${SITE_URL}${lang === 'pl' ? '/reviews' : '/en/reviews'}`;

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: copy.h1,
      description: copy.metaDescription,
      url: pageUrlFull,
      inLanguage: lang === 'pl' ? 'pl-PL' : 'en-US',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: SITE_NAME,
      url: SITE_URL,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Web browser',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'PLN' },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: String(agg.average),
        reviewCount: String(agg.count),
        bestRating: '5',
        worstRating: '1',
      },
    },
  ];
}
