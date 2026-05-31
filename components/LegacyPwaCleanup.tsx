'use client';

import { useEffect } from 'react';
import { needsLegacyFingerprintMigration, purgeLegacyPwa } from '@/lib/legacyPwaCleanup';

export default function LegacyPwaCleanup() {
  useEffect(() => {
    if (!needsLegacyFingerprintMigration()) return;
    purgeLegacyPwa().then((changed) => {
      if (changed) window.location.reload();
    });
  }, []);

  return null;
}
