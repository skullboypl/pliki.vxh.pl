'use client';

import dynamic from 'next/dynamic';

function loadCameraShare() {
  return import('@/components/CameraShare').catch((err: unknown) => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('vxh_chunk_reload') !== '1') {
      sessionStorage.setItem('vxh_chunk_reload', '1');
      const sep = window.location.search ? '&' : '?';
      window.location.replace(`${window.location.pathname}${window.location.search}${sep}_=${Date.now()}`);
    }
    throw err;
  });
}

const CameraShare = dynamic(() => loadCameraShare(), {
  ssr: false,
  loading: () => (
    <div className="app-container camera-share" aria-busy="true" aria-live="polite">
      <div className="app-loading" />
    </div>
  ),
});

export default function CameraShareClient() {
  return <CameraShare />;
}
