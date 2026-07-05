import { hasOpfsSupport } from '@/lib/opfsStorage';
import { putReceivedDownloadRecord } from '@/lib/receivedDownloadStore';

const DOWNLOAD_PREFIX = '/received-file/';
const TOKEN_TTL_MS = 30 * 60 * 1000;

export type ReceivedDownloadSource = {
  fileName: string;
  mime: string;
  size?: number;
  opfsEntryName?: string;
};

function safeDownloadFileName(fileName: string): string {
  return fileName.replace(/[/\\]+/g, '_').trim() || 'file';
}

export function receivedDownloadPath(token: string): string {
  return `${DOWNLOAD_PREFIX}${token}`;
}

/** File stream URL (SW serves bytes). */
export function receivedDownloadFileUrl(path: string): string {
  return path.includes('?') ? `${path}&dl=1` : `${path}?dl=1`;
}

/** Absolute same-origin URL for opening download outside PWA (Safari tab). */
export function resolvedReceivedDownloadFileUrl(path: string): string {
  const filePath = receivedDownloadFileUrl(path);
  if (typeof window !== 'undefined' && window.location?.origin) {
    return new URL(filePath, window.location.origin).href;
  }
  return filePath;
}

export async function createReceivedDownloadPath(
  source: ReceivedDownloadSource,
  lang?: 'pl' | 'en',
): Promise<string | null> {
  if (!source.opfsEntryName || !hasOpfsSupport()) return null;

  const token =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

  await putReceivedDownloadRecord({
    token,
    opfsEntryName: source.opfsEntryName,
    fileName: safeDownloadFileName(source.fileName),
    mime: source.mime || 'application/octet-stream',
    size: source.size ?? 0,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });

  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      navigator.serviceWorker.controller.postMessage({ type: 'VXH_DOWNLOAD_READY', token });
    } catch {
      /* ignore */
    }
  }

  return lang ? `${receivedDownloadPath(token)}?lang=${lang}` : receivedDownloadPath(token);
}

/** Same-origin URL download (user tap on real <a>, not programmatic blob). */
export function canUseReceivedDownloadUrl(source: ReceivedDownloadSource): boolean {
  return !!source.opfsEntryName && hasOpfsSupport();
}

export async function triggerReceivedDownload(source: ReceivedDownloadSource): Promise<boolean> {
  if (!canUseReceivedDownloadUrl(source)) return false;
  const path = await createReceivedDownloadPath(source);
  if (!path || typeof document === 'undefined') return false;
  const a = document.createElement('a');
  a.href = receivedDownloadFileUrl(path);
  a.download = source.fileName || 'file';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
}
