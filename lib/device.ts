export type DeviceKind = 'desktop' | 'iphone' | 'ipad' | 'android' | 'mobile';

const DEVICE_KINDS = new Set<DeviceKind>(['desktop', 'iphone', 'ipad', 'android', 'mobile']);

export function normalizeDeviceKind(value: unknown): DeviceKind {
  return typeof value === 'string' && DEVICE_KINDS.has(value as DeviceKind)
    ? (value as DeviceKind)
    : 'desktop';
}

export function detectDeviceKind(): DeviceKind {
  if (typeof navigator === 'undefined') return 'desktop';

  const ua = navigator.userAgent.toLowerCase();
  const isIpad =
    /ipad/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (/iphone|ipod/.test(ua)) return 'iphone';
  if (isIpad) return 'ipad';
  if (/android/.test(ua)) return 'android';
  if (/mobile|tablet|silk|phone/.test(ua)) return 'mobile';
  return 'desktop';
}

/** Installed PWA display modes (Chrome title-bar toggle uses window-controls-overlay). */
const PWA_DISPLAY_MODES = ['standalone', 'window-controls-overlay'] as const;

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  if ('standalone' in nav && !!nav.standalone) return true;
  return PWA_DISPLAY_MODES.some((mode) =>
    window.matchMedia(`(display-mode: ${mode})`).matches,
  );
}

export function watchPwaDisplayMode(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mqs = PWA_DISPLAY_MODES.map((mode) =>
    window.matchMedia(`(display-mode: ${mode})`),
  );
  const handler = () => onChange();
  mqs.forEach((mq) => mq.addEventListener('change', handler));
  return () => mqs.forEach((mq) => mq.removeEventListener('change', handler));
}

export function isMobileDeviceKind(kind: DeviceKind): boolean {
  return kind !== 'desktop';
}
