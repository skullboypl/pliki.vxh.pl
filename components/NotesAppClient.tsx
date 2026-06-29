'use client';

import dynamic from 'next/dynamic';

function loadNotesApp() {
  return import('@/components/NotesApp').catch((err: unknown) => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('vxh_chunk_reload') !== '1') {
      sessionStorage.setItem('vxh_chunk_reload', '1');
      const sep = window.location.search ? '&' : '?';
      window.location.replace(`${window.location.pathname}${window.location.search}${sep}_=${Date.now()}`);
    }
    throw err;
  });
}

const NotesApp = dynamic(() => loadNotesApp(), {
  ssr: false,
  loading: () => (
    <div className="app-container notes-app" aria-busy="true" aria-live="polite">
      <div className="app-loading" />
    </div>
  ),
});

export default function NotesAppClient() {
  return <NotesApp />;
}
