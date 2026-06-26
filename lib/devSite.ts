export const OFFICIAL_SITE_URL =
  process.env.NEXT_PUBLIC_OFFICIAL_SITE_URL?.replace(/\/$/, '') || 'https://pliki.vxh.pl';

/** Beta / staging app URL — tylko gdy ustawione w env (NEXT_PUBLIC_BETA_APP_URL). */
export function getBetaAppUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_BETA_APP_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.href.replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function isDevBannerEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_DEV_BANNER?.trim().toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
}
