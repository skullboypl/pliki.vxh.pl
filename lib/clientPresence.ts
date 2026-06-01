import {
  getClientSurface,
  type ClientSurface,
  otherSurfaceLabel,
} from '@/lib/clientSurface';

const CHANNEL = 'vxh_surface_presence_v1';
const PING_MS = 4000;
const STALE_MS = 12_000;

type PresenceMessage = { surface: ClientSurface; at: number };

/**
 * Detect another app surface (PWA + browser tab) in the same browser profile.
 * They share origin quota but should not share received-file lists.
 */
export function watchOtherClientSurface(
  onOther: (surface: ClientSurface) => void,
): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};

  const ch = new BroadcastChannel(CHANNEL);
  const me = getClientSurface();

  const ping = () => {
    const msg: PresenceMessage = { surface: me, at: Date.now() };
    ch.postMessage(msg);
  };

  ch.onmessage = (ev: MessageEvent<PresenceMessage>) => {
    const data = ev.data;
    if (!data?.surface || data.surface === me) return;
    if (Date.now() - data.at > STALE_MS) return;
    onOther(data.surface);
  };

  ping();
  const interval = setInterval(ping, PING_MS);

  return () => {
    clearInterval(interval);
    ch.close();
  };
}

export function formatDualSurfaceWarning(
  other: ClientSurface,
  lang: 'pl' | 'en',
): string {
  const otherLabel = otherSurfaceLabel(other, lang);
  if (lang === 'pl') {
    return `Masz też otwartą ${otherLabel}. To osobne połączenia w sieci, ale limit dysku przeglądarki jest wspólny. Przy dużych plikach (np. 8 GB) używaj jednego okna — wysyłka w jednym, odbiór w drugim.`;
  }
  return `You also have ${otherLabel} open. Those are separate network peers, but browser storage quota is shared. For large files (e.g. 8 GB), use one window for send and one for receive — not both as the same “client”.`;
}
