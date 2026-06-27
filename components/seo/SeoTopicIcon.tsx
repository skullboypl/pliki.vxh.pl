import type { ReactNode } from 'react';
import type { SeoTopicIconId } from '@/lib/seo/pages';

type Props = {
  id: SeoTopicIconId;
  size?: number;
};

function SvgWrap({ size, children }: { size: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export default function SeoTopicIcon({ id, size = 22 }: Props) {
  switch (id) {
    case 'wifi':
      return (
        <SvgWrap size={size}>
          <path d="M5 12.55a11 11 0 0 1 14.08 0" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" />
        </SvgWrap>
      );
    case 'lan':
      return (
        <SvgWrap size={size}>
          <rect x="3" y="4" width="7" height="5" rx="1" />
          <rect x="14" y="4" width="7" height="5" rx="1" />
          <rect x="8.5" y="15" width="7" height="5" rx="1" />
          <path d="M6.5 9v2.5L12 14M17.5 9v2.5L12 14M12 14v1" />
        </SvgWrap>
      );
    case 'phone':
      return (
        <SvgWrap size={size}>
          <rect x="7" y="2" width="10" height="20" rx="2" />
          <path d="M11 18h2" />
        </SvgWrap>
      );
    case 'cross':
      return (
        <SvgWrap size={size}>
          <rect x="3" y="5" width="8" height="14" rx="1.5" />
          <rect x="13" y="5" width="8" height="14" rx="1.5" />
          <path d="M11 12h2" />
        </SvgWrap>
      );
    case 'photos':
      return (
        <SvgWrap size={size}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.5" fill="currentColor" stroke="none" />
          <path d="m3 17 5-5 4 4 3-3 6 6" />
        </SvgWrap>
      );
    case 'video':
      return (
        <SvgWrap size={size}>
          <rect x="2" y="5" width="15" height="14" rx="2" />
          <path d="m17 10 5-3v10l-5-3z" fill="currentColor" stroke="none" />
        </SvgWrap>
      );
    case 'p2p':
      return (
        <SvgWrap size={size}>
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="12" r="3" />
          <path d="M9 12h6" />
        </SvgWrap>
      );
    case 'speed':
      return (
        <SvgWrap size={size}>
          <path d="M13 2 3 14h9l-1 8 10-12h-9z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" />
        </SvgWrap>
      );
    case 'office':
      return (
        <SvgWrap size={size}>
          <path d="M3 21h18" />
          <path d="M5 21V7l7-4v18" />
          <path d="M12 21V11l7-4v14" />
        </SvgWrap>
      );
    case 'home':
      return (
        <SvgWrap size={size}>
          <path d="m3 11 9-8 9 8" />
          <path d="M5 10v10h14V10" />
        </SvgWrap>
      );
    case 'privacy':
      return (
        <SvgWrap size={size}>
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </SvgWrap>
      );
    case 'howto':
      return (
        <SvgWrap size={size}>
          <path d="M8 6h13" />
          <path d="M8 12h13" />
          <path d="M8 18h13" />
          <path d="M3 6h.01" />
          <path d="M3 12h.01" />
          <path d="M3 18h.01" />
        </SvgWrap>
      );
    case 'faq':
      return (
        <SvgWrap size={size}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 0 1 4.2 1.8c0 1.2-2 1.7-2 3.2" />
          <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="none" />
        </SvgWrap>
      );
    case 'iphone':
      return (
        <SvgWrap size={size}>
          <rect x="7" y="2" width="10" height="20" rx="2.5" />
          <path d="M10 6h4" />
        </SvgWrap>
      );
    case 'account':
      return (
        <SvgWrap size={size}>
          <circle cx="12" cy="8" r="4" />
          <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
        </SvgWrap>
      );
    case 'cloud':
      return (
        <SvgWrap size={size}>
          <path d="M7 18h11a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6-1.5A4 4 0 0 0 7 18z" />
          <path d="m14 14-3 3M14 17l-3-3" />
        </SvgWrap>
      );
    case 'documents':
      return (
        <SvgWrap size={size}>
          <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
          <path d="M14 3v5a1 1 0 0 0 1 1h5" />
        </SvgWrap>
      );
    case 'music':
      return (
        <SvgWrap size={size}>
          <path d="M9 18V6l10-2v12" />
          <circle cx="7" cy="18" r="2" fill="currentColor" stroke="none" />
          <circle cx="17" cy="16" r="2" fill="currentColor" stroke="none" />
        </SvgWrap>
      );
    case 'security':
      return (
        <SvgWrap size={size}>
          <path d="M12 3 4 7v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V7z" />
          <path d="m9 12 2 2 4-4" />
        </SvgWrap>
      );
    case 'pwa':
      return (
        <SvgWrap size={size}>
          <path d="M12 3v10" />
          <path d="m8 7 4-4 4 4" />
          <path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
        </SvgWrap>
      );
    case 'drag':
      return (
        <SvgWrap size={size}>
          <path d="M12 3v12" />
          <path d="m7 8 5-5 5 5" />
          <path d="M5 21h14" />
        </SvgWrap>
      );
    case 'bundle':
      return (
        <SvgWrap size={size}>
          <path d="M4 7h16v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" />
          <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
          <path d="M4 11h16" />
        </SvgWrap>
      );
    case 'zip':
      return (
        <SvgWrap size={size}>
          <path d="M8 3h8l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
          <path d="M12 7v3M12 13v3" />
        </SvgWrap>
      );
    case 'camera':
      return (
        <SvgWrap size={size}>
          <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l.9-1.5h6.8L16.3 6h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" />
          <circle cx="12" cy="12.3" r="3.1" />
        </SvgWrap>
      );
    default:
      return (
        <SvgWrap size={size}>
          <circle cx="12" cy="12" r="9" />
        </SvgWrap>
      );
  }
}
