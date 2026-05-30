export const CANONICAL_SITE = 'https://pliki.vxh.pl';

export function getCanonicalShareUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const path = u.pathname || '/';
    const query = u.search || '';
    const local =
      u.hostname === 'localhost' ||
      u.hostname === '127.0.0.1' ||
      u.hostname.endsWith('.local') ||
      u.protocol === 'http:';

    if (local) {
      return `${CANONICAL_SITE}${path === '/' ? '' : path}${query}`;
    }
    return `${u.origin}${path}${query}`;
  } catch {
    return CANONICAL_SITE;
  }
}

export function openSharePopup(href: string): void {
  const popup = window.open(href, '_blank', 'width=600,height=520,scrollbars=yes,resizable=yes');
  if (!popup) {
    window.open(href, '_blank');
  }
}
