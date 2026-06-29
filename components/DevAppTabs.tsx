'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import '@/styles/dev-app-tabs.css';

type Props = {
  camera: boolean;
  notes: boolean;
};

const TAB_PATHS = new Set(['/', '/camera', '/notes']);

function IconFiles() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10l2 2.2h5.5A2.5 2.5 0 0 1 20 8.7v8.8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l.9-1.5h6.8L16.3 6h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12.3" r="3.1" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconNotes() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 4h9l5 5v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M14 4v5h5M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function DevAppTabs({ camera, notes }: Props) {
  const pathname = usePathname() || '/';

  if ((!camera && !notes) || !TAB_PATHS.has(pathname)) return null;

  const filesActive = pathname === '/';
  const cameraActive = pathname === '/camera';
  const notesActive = pathname === '/notes';

  return (
    <div className="dev-tabs-wrap">
      <nav className="dev-tabs dev-tabs--multi" role="tablist" aria-label="Pliki / Camera / Notes">
        <Link
          href="/"
          role="tab"
          aria-selected={filesActive}
          aria-current={filesActive ? 'page' : undefined}
          className={`dev-tabs__seg${filesActive ? ' dev-tabs__seg--active' : ''}`}
        >
          <IconFiles />
          <span>Pliki</span>
        </Link>
        {camera ? (
          <Link
            href="/camera"
            role="tab"
            aria-selected={cameraActive}
            aria-current={cameraActive ? 'page' : undefined}
            className={`dev-tabs__seg${cameraActive ? ' dev-tabs__seg--active' : ''}`}
          >
            <IconCamera />
            <span>Camera</span>
          </Link>
        ) : null}
        {notes ? (
          <Link
            href="/notes"
            role="tab"
            aria-selected={notesActive}
            aria-current={notesActive ? 'page' : undefined}
            className={`dev-tabs__seg${notesActive ? ' dev-tabs__seg--active' : ''}`}
          >
            <IconNotes />
            <span>Notes</span>
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
