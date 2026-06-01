import React from 'react';
import { peerAnimalKey } from '@/lib/nicknames';
import { isMobileDeviceKind, type DeviceKind } from '@/lib/device';

type IconProps = { size?: number; className?: string };

const svgBase = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

function Svg({ size = 24, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...svgBase}>
      {children}
    </svg>
  );
}

export function IconDesktop({ size = 22, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
    </Svg>
  );
}

export function IconIphone({ size = 22, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="7" y="2" width="10" height="20" rx="2.5" />
      <path d="M10 5h4" strokeWidth="2" />
      <circle cx="12" cy="18.5" r="0.75" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconTablet({ size = 22, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <circle cx="12" cy="18.5" r="0.75" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconSmartphone({ size = 22, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <path d="M12 18h.01" strokeWidth="2.5" />
    </Svg>
  );
}

export function IconGuest({ size = 24, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.2-3.5 4-5.5 7-5.5s5.8 2 7 5.5" />
    </Svg>
  );
}

function IconCat({ size = 24, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M6 8 8 4l2 4M14 8l2-4 2 4" />
      <circle cx="12" cy="13" r="5" />
      <path d="M9 13h.01M15 13h.01" strokeWidth="2.5" />
      <path d="M8 16c1 1 2.5 1.5 4 1.5s3-.5 4-1.5" />
    </Svg>
  );
}

function IconDog({ size = 24, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M5 10c0-2 1-4 3-4s2 2 3 2 1-2 3-2 3 2 3 4" />
      <ellipse cx="12" cy="14" rx="6" ry="5" />
      <circle cx="10" cy="13" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="14" cy="13" r="0.75" fill="currentColor" stroke="none" />
      <path d="M11 16h2" />
    </Svg>
  );
}

function IconFox({ size = 24, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M6 9 9 4l3 5M15 9l3-5 3 5" />
      <path d="M8 20c1-4 2.5-6 4-6s3 2 4 6" />
      <path d="M12 9v3" />
      <circle cx="10" cy="12" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="14" cy="12" r="0.75" fill="currentColor" stroke="none" />
    </Svg>
  );
}

function IconEagle({ size = 24, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M4 14c3-2 5-6 8-8 3 2 5 6 8 8" />
      <path d="M12 6v8" />
      <path d="M9 10h6" />
    </Svg>
  );
}

function IconPanda({ size = 24, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <circle cx="12" cy="13" r="5.5" />
      <circle cx="9.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="8" r="1.5" fill="currentColor" stroke="none" />
    </Svg>
  );
}

function IconWhale({ size = 24, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M4 14c2-4 6-6 10-5 3 .8 5 3 6 6-2 1-4 1.5-6 1.5S7 15 4 14Z" />
      <path d="M18 10c1-1 2-1 3 0" />
      <circle cx="9" cy="12" r="0.75" fill="currentColor" stroke="none" />
    </Svg>
  );
}

function IconDolphin({ size = 24, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M5 14c3-5 8-7 12-5 1 .5 2 2 2 4-3 2-6 2-9 1-2-.8-3.5-2.5-5-4Z" />
      <path d="M17 9l2-2" />
      <circle cx="11" cy="12" r="0.75" fill="currentColor" stroke="none" />
    </Svg>
  );
}

function IconOwl({ size = 24, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <circle cx="12" cy="13" r="5.5" />
      <circle cx="9.5" cy="12.5" r="2" />
      <circle cx="14.5" cy="12.5" r="2" />
      <circle cx="9.5" cy="12.5" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="12.5" r="0.75" fill="currentColor" stroke="none" />
      <path d="M10 17h4" />
      <path d="M8 7 10 9M16 7l-2 2" />
    </Svg>
  );
}

function IconRabbit({ size = 24, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M9 4c0 3-1 5-2 6M15 4c0 3 1 5 2 6" />
      <circle cx="12" cy="14" r="5" />
      <circle cx="10" cy="13" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="14" cy="13" r="0.75" fill="currentColor" stroke="none" />
      <path d="M11 16c.5.5 1.5.5 2 0" />
    </Svg>
  );
}

function IconBear({ size = 24, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <circle cx="8" cy="9" r="2" />
      <circle cx="16" cy="9" r="2" />
      <circle cx="12" cy="14" r="5.5" />
      <circle cx="10" cy="13" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="14" cy="13" r="0.75" fill="currentColor" stroke="none" />
      <ellipse cx="12" cy="16" rx="1.5" ry="1" />
    </Svg>
  );
}

function IconWolf({ size = 24, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M7 9 9 5l3 4M14 9l3-4 3 4" />
      <path d="M8 19c1.5-4 2.5-6 4-6s2.5 2 4 6" />
      <circle cx="10" cy="13" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="14" cy="13" r="0.75" fill="currentColor" stroke="none" />
      <path d="M11 16h2" />
    </Svg>
  );
}

function IconDeer({ size = 24, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M8 5 10 9M16 5l-2 4" />
      <path d="M7 5 5 3M17 5l2-2" />
      <circle cx="12" cy="14" r="4.5" />
      <circle cx="10.5" cy="13.5" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="13.5" cy="13.5" r="0.75" fill="currentColor" stroke="none" />
    </Svg>
  );
}

function IconSeal({ size = 24, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M5 15c2-4 5-6 9-5 3 .8 5 3 5 6H5Z" />
      <circle cx="10" cy="13" r="0.75" fill="currentColor" stroke="none" />
      <path d="M6 16c1 1 3 1.5 5 1" />
    </Svg>
  );
}

const ANIMAL_ICONS: Record<string, React.ComponentType<IconProps>> = {
  cat: IconCat,
  dog: IconDog,
  fox: IconFox,
  eagle: IconEagle,
  panda: IconPanda,
  whale: IconWhale,
  dolphin: IconDolphin,
  owl: IconOwl,
  rabbit: IconRabbit,
  bear: IconBear,
  wolf: IconWolf,
  deer: IconDeer,
  seal: IconSeal,
};

export function PeerAnimalIcon({ name, size = 28, className }: { name: string; size?: number; className?: string }) {
  const Icon = ANIMAL_ICONS[peerAnimalKey(name)] || IconGuest;
  return <Icon size={size} className={className} />;
}

/** Monitor + mała ikona aplikacji (PWA na PC). */
export function IconPwaDesktop({ size = 22, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="2.5" y="4" width="19" height="12" rx="1.5" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
      <rect x="14" y="6.5" width="5.5" height="5.5" rx="1.25" fill="currentColor" stroke="none" opacity="0.9" />
      <path d="M15.2 8.2h3.6M15.2 10h3.6" stroke="#0a0a0a" strokeWidth="0.65" />
    </Svg>
  );
}

/** Telefon / tablet z siatką (PWA na mobile). */
export function IconPwaMobile({ size = 22, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="6.5" y="2" width="11" height="20" rx="2.25" />
      <path d="M9.5 5h5" strokeWidth="1.5" />
      <rect x="8.5" y="14" width="7" height="5" rx="1" fill="currentColor" stroke="none" opacity="0.85" />
      <path d="M9.8 15.2h1.6v1.6M12.6 15.2h1.6v1.6M9.8 17.2h1.6v1.6M12.6 17.2h1.6v1.6" stroke="#0a0a0a" strokeWidth="0.55" />
    </Svg>
  );
}

export function IconPwaTablet({ size = 22, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="4.5" y="3" width="15" height="18" rx="2" />
      <rect x="7.5" y="13" width="9" height="5" rx="1" fill="currentColor" stroke="none" opacity="0.85" />
      <path d="M8.8 14.2h1.4v1.4M10.8 14.2h1.4v1.4M12.8 14.2h1.4v1.4M8.8 16h1.4v1.4M10.8 16h1.4v1.4M12.8 16h1.4v1.4" stroke="#0a0a0a" strokeWidth="0.5" />
    </Svg>
  );
}

export function PeerDeviceIcon({
  kind,
  standalone = false,
  size = 20,
  className,
}: {
  kind: DeviceKind;
  standalone?: boolean;
  size?: number;
  className?: string;
}) {
  if (standalone) {
    if (kind === 'ipad') return <IconPwaTablet size={size} className={className} />;
    if (isMobileDeviceKind(kind)) return <IconPwaMobile size={size} className={className} />;
    return <IconPwaDesktop size={size} className={className} />;
  }

  switch (kind) {
    case 'iphone':
      return <IconIphone size={size} className={className} />;
    case 'ipad':
      return <IconTablet size={size} className={className} />;
    case 'android':
    case 'mobile':
      return <IconSmartphone size={size} className={className} />;
    default:
      return <IconDesktop size={size} className={className} />;
  }
}
