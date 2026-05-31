'use client';

import { useEffect } from 'react';

const STORAGE_KEY = 'vxh_app_fingerprint';
const LEGACY_STORAGE_KEY = 'vxh_build_id';

function fingerprintFrom(data: { buildId?: string; version?: string }) {
  if (!data.buildId) return '';
  return `${data.buildId}@${data.version ?? '0'}`;
}

async function clearBrowserCaches() {
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((reg) => reg.unregister()));
  }
}

export default function AppUpdateCheck() {
  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch(`/api/build-id?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        });
        if (!res.ok || cancelled) return;

        const data = (await res.json()) as { buildId?: string; version?: string };
        const next = fingerprintFrom(data);
        if (!next) return;

        const prev = localStorage.getItem(STORAGE_KEY);
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);

        if (prev && prev !== next) {
          localStorage.setItem(STORAGE_KEY, next);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          await clearBrowserCaches();
          window.location.reload();
          return;
        }

        if (!prev && legacy && legacy !== data.buildId) {
          localStorage.setItem(STORAGE_KEY, next);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          await clearBrowserCaches();
          window.location.reload();
          return;
        }

        localStorage.setItem(STORAGE_KEY, next);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        /* offline */
      }
    };

    check();

    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onPageShow);
    const interval = window.setInterval(check, 60_000);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onPageShow);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
