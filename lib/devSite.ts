export const OFFICIAL_SITE_URL =
  process.env.NEXT_PUBLIC_OFFICIAL_SITE_URL?.replace(/\/$/, '') || 'https://pliki.vxh.pl';

export const DEV_SERVER_URL = 'https://pliki-vxh-pl-developer.vpsskull.vxh.pl';

export function isDevBannerEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_DEV_BANNER?.trim().toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
}
