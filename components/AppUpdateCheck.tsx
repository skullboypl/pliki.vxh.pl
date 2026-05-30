'use client';

import { useEffect } from 'react';

const STORAGE_KEY = 'vxh_build_id';

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

        const data = (await res.json()) as { buildId?: string };
        if (!data.buildId) return;

        const prev = localStorage.getItem(STORAGE_KEY);
        if (prev && prev !== data.buildId) {
          localStorage.setItem(STORAGE_KEY, data.buildId);
          window.location.reload();
          return;
        }
        localStorage.setItem(STORAGE_KEY, data.buildId);
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
    const interval = window.setInterval(check, 120_000);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onPageShow);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
