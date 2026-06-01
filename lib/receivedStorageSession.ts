/** Tracks tab/PWA session — per surface (PWA vs browser), not shared between them. */

import { getClientSurface, type ClientSurface } from '@/lib/clientSurface';

const LEGACY_SESSION_KEY = 'vxh_recv_browser_session_v1';

export const RECEIVED_PAGE_RELOADING_KEY = 'vxh_recv_page_reloading_v1';

function sessionKey(surface: ClientSurface = getClientSurface()): string {
  return surface === 'pwa'
    ? 'vxh_recv_browser_session_v1_pwa'
    : 'vxh_recv_browser_session_v1_browser';
}

export function markPageReloading(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(RECEIVED_PAGE_RELOADING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function isPageReloading(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    return sessionStorage.getItem(RECEIVED_PAGE_RELOADING_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearPageReloadingFlag(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(RECEIVED_PAGE_RELOADING_KEY);
  } catch {
    /* ignore */
  }
}

export function isNewBrowserSession(surface: ClientSurface = getClientSurface()): boolean {
  if (typeof sessionStorage === 'undefined') return true;
  try {
    const key = sessionKey(surface);
    if (sessionStorage.getItem(key)) return false;
    if (surface === 'browser' && sessionStorage.getItem(LEGACY_SESSION_KEY)) {
      sessionStorage.setItem(key, '1');
      sessionStorage.removeItem(LEGACY_SESSION_KEY);
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

export function markBrowserSession(surface: ClientSurface = getClientSurface()): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(sessionKey(surface), '1');
  } catch {
    /* ignore */
  }
}

export function clearBrowserSessionMarker(surface: ClientSurface = getClientSurface()): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(sessionKey(surface));
  } catch {
    /* ignore */
  }
}

/** @deprecated use clearBrowserSessionMarker */
export const RECEIVED_BROWSER_SESSION_KEY = LEGACY_SESSION_KEY;
