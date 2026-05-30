'use client';

import { useEffect } from 'react';
import { purgeLegacyPwa } from '@/lib/legacyPwaCleanup';

export default function LegacyPwaCleanup() {
  useEffect(() => {
    purgeLegacyPwa().then((changed) => {
      if (changed) window.location.reload();
    });
  }, []);

  return null;
}
