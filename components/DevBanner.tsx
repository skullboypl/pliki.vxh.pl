import { OFFICIAL_SITE_URL, isDevBannerEnabled } from '@/lib/devSite';

export default function DevBanner() {
  if (!isDevBannerEnabled()) return null;

  const officialHost = OFFICIAL_SITE_URL.replace(/^https?:\/\//, '');

  return (
    <div className="dev-banner" role="status" aria-live="polite">
      <span className="dev-banner__badge">DEV</span>
      <span className="dev-banner__text">
        Serwer deweloperski — do wysyłki plików korzystaj z oficjalnej wersji:{' '}
        <a href={OFFICIAL_SITE_URL}>{officialHost}</a>
        <span className="dev-banner__en">
          {' '}
          · Dev preview — please use the official app:{' '}
          <a href={OFFICIAL_SITE_URL}>{officialHost}</a>
        </span>
      </span>
    </div>
  );
}
