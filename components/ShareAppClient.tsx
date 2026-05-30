'use client';

import dynamic from 'next/dynamic';

const ShareApp = dynamic(() => import('@/components/ShareApp'), {
  ssr: false,
  loading: () => (
    <div className="app-container" aria-busy="true" aria-live="polite">
      <div className="app-loading" />
    </div>
  ),
});

export default function ShareAppClient() {
  return <ShareApp />;
}
