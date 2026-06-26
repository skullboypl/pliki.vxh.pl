import { DEV_SERVER_URL, isDevBannerEnabled } from '@/lib/devSite';
import '@/styles/beta-link.css';

/**
 * Odwrotność DevBanner: na PRODUKCJI pokazuje mały link do wersji beta (dev app).
 * Na samej becie (NEXT_PUBLIC_DEV_BANNER=1) chowa się — tam jest już DevBanner.
 * Renderowane w force-dynamic root layout → env czytane w runtime (CapRover).
 * Poza `web-only`, więc widoczne też w PWA.
 */
export default function BetaLink() {
  if (isDevBannerEnabled()) return null;

  const host = DEV_SERVER_URL.replace(/^https?:\/\//, '');

  return (
    <div className="beta-strip">
      <a
        className="beta-strip__link"
        href={DEV_SERVER_URL}
        target="_blank"
        rel="noopener noreferrer"
        title={`Wersja beta — ${host}`}
        aria-label={`Wersja beta / beta version: ${host} (otwórz w nowej karcie)`}
      >
        <span className="beta-strip__badge">BETA</span>
        <span className="beta-strip__text">Wersja beta</span>
        <span className="beta-strip__arrow" aria-hidden>
          ↗
        </span>
      </a>
    </div>
  );
}
