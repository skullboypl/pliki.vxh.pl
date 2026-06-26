import type { Metadata, Viewport } from 'next';
import { Ubuntu } from 'next/font/google';
import AppUpdateCheck from '@/components/AppUpdateCheck';
import BetaLink from '@/components/BetaLink';
import DevBanner from '@/components/DevBanner';
import LegacyPwaCleanup from '@/components/LegacyPwaCleanup';
import PwaUpdateManager from '@/components/PwaUpdateManager';
import { isDevBannerEnabled } from '@/lib/devSite';
import { appBootScript } from '@/lib/appBootScript';
import { buildHomeMetadata } from '@/lib/seo/appMeta';
import './globals.css';

export const dynamic = 'force-dynamic';

const ubuntu = Ubuntu({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
});

export const metadata: Metadata = buildHomeMetadata();

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const appFingerprint = process.env.APP_FINGERPRINT ?? 'unknown@0';
  const devBanner = isDevBannerEnabled();

  return (
    <html lang="pl" className={ubuntu.className} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="vxh-app-version" content={appFingerprint} />
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <script
          dangerouslySetInnerHTML={{
            __html: appBootScript(process.env.NODE_ENV !== 'production'),
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `document.querySelectorAll('body link[rel="manifest"],body link[rel="icon"],body link[rel="apple-touch-icon"]').forEach(function(el){document.head.appendChild(el);});`,
          }}
        />
      </head>
      <body className={devBanner ? 'has-dev-banner' : undefined}>
        {devBanner ? <DevBanner /> : null}
        <LegacyPwaCleanup />
        <AppUpdateCheck />
        <PwaUpdateManager />
        {children}
        <BetaLink />
      </body>
    </html>
  );
}
