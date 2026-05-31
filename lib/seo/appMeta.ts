import type { Metadata } from 'next';
import { GITHUB_REPO_URL, SITE_NAME, SITE_URL } from '@/lib/seo/site';

/** Główna aplikacja (/) — copy pod pliki.vxh.pl i transfer LAN bez instalacji. */
export const HOME_COPY = {
  pl: {
    title: 'pliki.vxh.pl — wyślij plik w WiFi bez aplikacji',
    shortTitle: 'Wyślij plik | pliki.vxh.pl',
    description:
      'Przesyłaj pliki między telefonem, komputerem i tabletem w tej samej sieci WiFi. Bez instalacji aplikacji, bez chmury i bez rejestracji. Transfer P2P w sieci lokalnej (LAN) przez WebRTC.',
    keywords: [
      'pliki.vxh.pl',
      'wyślij plik wifi',
      'transfer plików lan',
      'przesyłanie plików w sieci lokalnej',
      'udostępnianie plików bez aplikacji',
      'telefon na komputer wifi',
      'p2p webrtc',
      'transfer plików bez chmury',
      'lan file transfer',
      'send file wifi',
    ],
    ogAlt: 'pliki.vxh.pl — przesyłanie plików w sieci lokalnej bez aplikacji',
  },
  en: {
    title: 'pliki.vxh.pl — send files on WiFi, no app needed',
    shortTitle: 'Send files | pliki.vxh.pl',
    description:
      'Transfer files between phone, PC and tablet on the same WiFi network. No app install, no cloud upload, no signup. Direct P2P over your local network (LAN) via WebRTC.',
    keywords: [
      'pliki.vxh.pl',
      'send file wifi',
      'lan file transfer',
      'local network file sharing',
      'no app file transfer',
      'phone to pc wifi',
      'p2p webrtc',
      'offline file transfer',
      'wifi file share',
    ],
    ogAlt: 'pliki.vxh.pl — local network file transfer without an app',
  },
} as const;

export const OG_IMAGE = {
  url: '/og-image.svg',
  width: 1200,
  height: 630,
  type: 'image/svg+xml',
} as const;

export const APP_ICONS = {
  icon: [
    { url: '/icon', type: 'image/png' as const, sizes: '512x512' },
    { url: '/icon.svg', type: 'image/svg+xml' as const },
  ],
  shortcut: '/icon-512',
  apple: '/apple-icon',
};

export function buildHomeMetadata(): Metadata {
  const pl = HOME_COPY.pl;

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: pl.shortTitle,
      template: '%s | pliki.vxh.pl',
    },
    description: pl.description,
    keywords: [...pl.keywords],
    applicationName: SITE_NAME,
    authors: [{ name: SITE_NAME, url: SITE_URL }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    category: 'utilities',
    alternates: {
      canonical: '/',
      languages: {
        pl: '/',
        en: '/',
        'x-default': '/',
      },
    },
    openGraph: {
      type: 'website',
      locale: 'pl_PL',
      alternateLocale: ['en_US'],
      url: SITE_URL,
      siteName: SITE_NAME,
      title: pl.title,
      description: pl.description,
      images: [
        {
          url: OG_IMAGE.url,
          width: OG_IMAGE.width,
          height: OG_IMAGE.height,
          alt: pl.ogAlt,
          type: OG_IMAGE.type,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: pl.title,
      description: pl.description,
      images: [OG_IMAGE.url],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
    },
    icons: APP_ICONS,
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: SITE_NAME,
    },
    other: {
      'mobile-web-app-capable': 'yes',
    },
  };
}

export function jsonLdHome() {
  const pl = HOME_COPY.pl;
  const en = HOME_COPY.en;

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
      description: pl.description,
      inLanguage: ['pl-PL', 'en-US'],
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_URL}/pl?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: SITE_NAME,
      url: SITE_URL,
      description: pl.description,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any (browser)',
      browserRequirements: 'Requires JavaScript. Devices must be on the same WiFi or LAN.',
      softwareVersion: process.env.NEXT_PUBLIC_APP_VERSION,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'PLN',
      },
      featureList: [
        'Transfer plików P2P w sieci lokalnej (LAN / WiFi)',
        'Bez instalacji aplikacji — działa w przeglądarce',
        'Bez chmury, limitów uploadu i rejestracji',
        'Telefon, komputer, tablet — ta sama sieć',
        'WebRTC — dane między urządzeniami, nie przez serwer plików',
      ],
      inLanguage: ['pl-PL', 'en-US'],
      alternateName: en.title,
      isAccessibleForFree: true,
      ...(GITHUB_REPO_URL ? { codeRepository: GITHUB_REPO_URL } : {}),
    },
  ];
}
