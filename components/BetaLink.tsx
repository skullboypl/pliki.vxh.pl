import { getBetaAppUrl, isDevBannerEnabled } from '@/lib/devSite';
import '@/styles/beta-link.css';

/**
 * Link do wersji beta — tylko gdy NEXT_PUBLIC_BETA_APP_URL jest ustawione
 * i nie jesteśmy na samej becie (NEXT_PUBLIC_DEV_BANNER).
 * Poza `web-only`, więc widoczne też w PWA.
 */
export default function BetaLink() {
  if (isDevBannerEnabled()) return null;

  const betaUrl = getBetaAppUrl();
  if (!betaUrl) return null;

  const host = betaUrl.replace(/^https?:\/\//, '');

  return (
    <div className="beta-strip">
      <a
        className="beta-strip__link"
        href={betaUrl}
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
