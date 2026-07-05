export type SaveableFile = {
  fileName: string;
  url: string;
  mime: string;
  file?: File;
};

export type SaveReceivedFileResult = 'saved' | 'cancelled' | 'failed';

const IOS_SHARE_MIME_BY_EXT: Record<string, string> = {
  '.mov': 'video/mp4',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.pdf': 'application/pdf',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.zip': 'application/zip',
};

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot).toLowerCase() : '';
}

/** iOS Web Share accepts only a subset of MIME types; .mov often arrives as video/quicktime. */
export function iosShareMime(fileName: string, mime: string): string {
  const ext = fileExtension(fileName);
  const fromExt = IOS_SHARE_MIME_BY_EXT[ext];
  if (fromExt) return fromExt;
  if (mime === 'video/quicktime') return 'video/mp4';
  if (!mime || mime === 'application/octet-stream') return fromExt || mime || 'application/octet-stream';
  return mime;
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  const win = typeof window !== 'undefined' ? (window as Window & { MSStream?: unknown }) : undefined;
  return /iphone|ipad|ipod/.test(ua) && !win?.MSStream;
}

function buildShareFile(item: SaveableFile, mime: string): File | null {
  const source = item.file;
  if (!source) return null;
  const name = item.fileName || source.name || 'file';
  return new File([source], name, {
    type: mime,
    lastModified: source.lastModified ?? Date.now(),
  });
}

function triggerAnchorDownload(item: SaveableFile): boolean {
  try {
    const a = document.createElement('a');
    a.href = item.url;
    a.download = item.fileName || 'file';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch {
    return false;
  }
}

function isAbortError(err: unknown): boolean {
  return !!err && typeof err === 'object' && 'name' in err && (err as { name?: string }).name === 'AbortError';
}

/**
 * iOS PWA: only the system share sheet can save files (Zapisz w Plikach).
 * Never open blob URLs in a new tab, that breaks standalone PWA and reloads the app.
 */
async function saveOnIos(item: SaveableFile): Promise<SaveReceivedFileResult> {
  if (typeof navigator.share !== 'function') return 'failed';

  const primaryMime = iosShareMime(item.fileName, item.file?.type || item.mime);
  const primary = buildShareFile(item, primaryMime);
  if (!primary) return 'failed';

  const candidates: File[] = [primary];
  if (fileExtension(item.fileName) === '.mov' && primaryMime !== 'video/mp4') {
    const alt = buildShareFile(item, 'video/mp4');
    if (alt) candidates.push(alt);
  }

  for (const file of candidates) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return 'saved';
    } catch (err) {
      if (isAbortError(err)) return 'cancelled';
    }
  }

  return 'failed';
}

export async function saveReceivedFile(item: SaveableFile): Promise<SaveReceivedFileResult> {
  if (isIosDevice()) return saveOnIos(item);
  return triggerAnchorDownload(item) ? 'saved' : 'failed';
}

export async function saveBlobDownload(blob: Blob, fileName: string): Promise<SaveReceivedFileResult> {
  const mime = iosShareMime(fileName, blob.type || 'application/octet-stream');
  const file = new File([blob], fileName, { type: mime });
  const url = URL.createObjectURL(blob);
  try {
    return await saveReceivedFile({ fileName, url, mime, file });
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
