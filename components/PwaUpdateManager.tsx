'use client';

import { useEffect } from 'react';
import { registerPwaUpdateService } from '@/lib/pwaUpdate';

export default function PwaUpdateManager() {
  useEffect(() => {
    registerPwaUpdateService();
  }, []);

  return null;
}
