import { isStandalonePwa } from '@/lib/device';

/** Installed PWA vs normal browser tab — same origin but separate app surfaces. */
export type ClientSurface = 'pwa' | 'browser';

export function getClientSurface(): ClientSurface {
  return isStandalonePwa() ? 'pwa' : 'browser';
}

export function opfsPrefixForSurface(surface: ClientSurface = getClientSurface()): string {
  return surface === 'pwa' ? 'pwa_' : 'br_';
}

export function buildOpfsEntryName(
  fileName: string,
  surface: ClientSurface = getClientSurface(),
): string {
  const safe = fileName.replace(/[/\\]/g, '_') || 'file';
  return `${opfsPrefixForSurface(surface)}${Date.now()}_${safe}`;
}

/** OPFS entry belongs to this surface (legacy `1234_name` = browser only). */
export function opfsEntryBelongsToSurface(
  entryName: string,
  surface: ClientSurface = getClientSurface(),
): boolean {
  if (entryName.startsWith('pwa_')) return surface === 'pwa';
  if (entryName.startsWith('br_')) return surface === 'browser';
  return /^\d+_/.test(entryName) && surface === 'browser';
}

export function timestampFromOpfsEntry(entryName: string): number {
  const body = entryName.replace(/^(?:pwa_|br_)/, '');
  return Number(body.split('_')[0]) || 0;
}

export function otherSurfaceLabel(surface: ClientSurface, lang: 'pl' | 'en'): string {
  if (surface === 'pwa') return lang === 'pl' ? 'aplikacja PWA' : 'PWA app';
  return lang === 'pl' ? 'karta Chrome' : 'Chrome tab';
}
