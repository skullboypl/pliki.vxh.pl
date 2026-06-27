'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import '@/styles/dev-app-tabs.css';

type Props = {
  enabled: boolean;
};

const TAB_PATHS = new Set(['/', '/camera']);

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

export default function DevAppTabs({ enabled }: Props) {
  const pathname = usePathname() || '/';

  if (!enabled || !TAB_PATHS.has(pathname)) return null;

  const filesActive = pathname === '/';
  const cameraActive = pathname === '/camera';

  return (
    <div className="dev-tabs-wrap">
      <nav className="dev-tabs" role="tablist" aria-label="Pliki / Camera">
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
      </nav>
    </div>
  );
}
