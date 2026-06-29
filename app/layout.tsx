import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Ubuntu } from 'next/font/google';import AppUpdateCheck from '@/components/AppUpdateCheck';
import BetaLink from '@/components/BetaLink';
import DevAppTabs from '@/components/DevAppTabs';
import DevBanner from '@/components/DevBanner';
import LegacyPwaCleanup from '@/components/LegacyPwaCleanup';
import PwaUpdateManager from '@/components/PwaUpdateManager';
import { isCameraShareEnabled, isDevBannerEnabled, isNotesShareEnabled } from '@/lib/devSite';
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const appFingerprint = process.env.APP_FINGERPRINT ?? 'unknown@0';
  const devBanner = isDevBannerEnabled();
  const cameraShare = isCameraShareEnabled();
  const notesShare = isNotesShareEnabled();
  const hdrs = await headers();
  const obsBare = hdrs.get('x-obs-bare') === '1';

  return (
    <html
      lang="pl"
      className={`${ubuntu.className}${obsBare ? ' obs-bare' : ''}`}
      suppressHydrationWarning
    >
      <head>
        {!obsBare ? <link rel="manifest" href="/manifest.webmanifest" /> : null}
        <meta name="vxh-app-version" content={appFingerprint} />
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        {!obsBare ? (
          <script
            dangerouslySetInnerHTML={{
              __html: appBootScript(process.env.NODE_ENV !== 'production'),
            }}
          />
        ) : null}
        {!obsBare ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `document.querySelectorAll('body link[rel="manifest"],body link[rel="icon"],body link[rel="apple-touch-icon"]').forEach(function(el){document.head.appendChild(el);});`,
            }}
          />
        ) : null}
      </head>
      <body
        className={
          obsBare ? 'obs-bare' : devBanner ? 'has-dev-banner' : undefined
        }
      >
        {!obsBare && devBanner ? <DevBanner /> : null}
        {!obsBare ? <DevAppTabs camera={cameraShare} notes={notesShare} /> : null}
        {!obsBare ? <LegacyPwaCleanup /> : null}
        {!obsBare ? <AppUpdateCheck /> : null}
        {!obsBare ? <PwaUpdateManager /> : null}
        {children}
        {!obsBare ? <BetaLink /> : null}
      </body>
    </html>
  );
}
