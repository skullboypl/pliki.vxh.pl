'use client';

import { useEffect } from 'react';
import { syncAppVersionIfStale } from '@/lib/appVersionClient';

/** Long-lived tabs: re-check when user returns (deploy while tab was open). Boot script handles first paint. */
export default function AppUpdateCheck() {
  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (cancelled) return;
      await syncAppVersionIfStale();
    };

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
