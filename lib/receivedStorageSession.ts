/** Tracks browser/PWA tab session — cleared when tab/app closes; used to purge received OPFS on next open. */

export const RECEIVED_BROWSER_SESSION_KEY = 'vxh_recv_browser_session_v1';

/** Set in beforeunload so pagehide can skip purge on F5 / hard reload. */
export const RECEIVED_PAGE_RELOADING_KEY = 'vxh_recv_page_reloading_v1';

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

export function isNewBrowserSession(): boolean {
  if (typeof sessionStorage === 'undefined') return true;
  try {
    return !sessionStorage.getItem(RECEIVED_BROWSER_SESSION_KEY);
  } catch {
    return true;
  }
}

export function markBrowserSession(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(RECEIVED_BROWSER_SESSION_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearBrowserSessionMarker(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(RECEIVED_BROWSER_SESSION_KEY);
  } catch {
    /* ignore */
  }
}
