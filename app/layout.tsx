import type { Metadata, Viewport } from 'next';
import { Ubuntu } from 'next/font/google';
import AppUpdateCheck from '@/components/AppUpdateCheck';
import LegacyPwaCleanup from '@/components/LegacyPwaCleanup';
import { legacyPwaCleanupScript } from '@/lib/legacyPwaCleanup';
import './globals.css';

const ubuntu = Ubuntu({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://pliki.vxh.pl'),
  title: {
    default: 'Wyślij plik | pliki.vxh.pl',
    template: '%s',
  },
  description: 'Szybkie wysyłanie plików w tej samej sieci WiFi — P2P, bez chmury.',
  alternates: {
    canonical: '/',
    languages: {
      pl: '/pl',
      en: '/en',
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'pliki.vxh.pl',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={ubuntu.className} suppressHydrationWarning>
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <script dangerouslySetInnerHTML={{ __html: legacyPwaCleanupScript() }} />
      </head>
      <body>
        <LegacyPwaCleanup />
        <AppUpdateCheck />
        {children}
      </body>
    </html>
  );
}
