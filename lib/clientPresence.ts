import { getClientSurface, type ClientSurface } from '@/lib/clientSurface';

const CHANNEL = 'vxh_surface_presence_v1';
const PING_MS = 4000;
const STALE_MS = 12_000;

type PresenceMessage = { surface: ClientSurface; at: number };

/**
 * Detect another app surface (PWA + browser tab) in the same browser profile.
 * They share origin quota but should not share received-file lists.
 */
export function watchOtherClientSurface(
  onOther: (surface: ClientSurface | null) => void,
): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};

  const ch = new BroadcastChannel(CHANNEL);
  const me = getClientSurface();
  let lastSeenOtherAt = 0;
  let lastSurface: ClientSurface | null = null;

  const ping = () => {
    const msg: PresenceMessage = { surface: me, at: Date.now() };
    ch.postMessage(msg);
  };

  ch.onmessage = (ev: MessageEvent<PresenceMessage>) => {
    const data = ev.data;
    if (!data?.surface || data.surface === me) return;
    if (Date.now() - data.at > STALE_MS) return;
    lastSeenOtherAt = Date.now();
    lastSurface = data.surface;
    onOther(data.surface);
  };

  ping();
  const interval = setInterval(ping, PING_MS);
  const staleCheck = setInterval(() => {
    if (!lastSurface) return;
    if (Date.now() - lastSeenOtherAt > STALE_MS) {
      lastSurface = null;
      onOther(null);
    }
  }, 1000);

  return () => {
    clearInterval(interval);
    clearInterval(staleCheck);
    ch.close();
  };
}

export function formatDualSurfaceWarning(
  other: ClientSurface,
  lang: 'pl' | 'en',
): string {
  if (lang === 'pl') {
    return other === 'pwa'
      ? 'Masz też otwartą aplikacja PWA'
      : 'Masz też otwartą karta Chrome';
  }
  return other === 'pwa'
    ? 'You also have the PWA app open'
    : 'You also have a Chrome tab open';
}
