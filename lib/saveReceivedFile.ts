export type SaveableFile = {
  fileName: string;
  url: string;
  mime: string;
  file?: File;
};

export type SaveReceivedFileResult = 'shared' | 'downloaded' | 'opened' | 'cancelled' | 'failed';

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

function blobSource(item: SaveableFile): Blob | File | null {
  return item.file ?? null;
}

function fileForShare(item: SaveableFile, mime: string): File | null {
  const source = blobSource(item);
  if (!source) return null;
  const name = item.fileName || (source instanceof File ? source.name : '') || 'file';
  if (source instanceof File && source.name === name && source.type === mime) return source;
  return new File([source], name, {
    type: mime,
    lastModified: source instanceof File ? source.lastModified : Date.now(),
  });
}

function shareCandidates(item: SaveableFile): File[] {
  const baseMime = iosShareMime(item.fileName, item.file?.type || item.mime);
  const primary = fileForShare(item, baseMime);
  if (!primary) return [];

  const seen = new Set<string>();
  const out: File[] = [];
  const push = (file: File) => {
    const key = `${file.name}\0${file.type}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(file);
  };

  push(primary);

  const ext = fileExtension(item.fileName);
  if (ext === '.mov' || ext === '.mp4' || ext === '.m4v') {
    for (const mime of ['video/mp4', 'video/quicktime']) {
      const alt = fileForShare(item, mime);
      if (alt) push(alt);
    }
  }

  const declared = item.file?.type || item.mime;
  if (declared && declared !== baseMime) {
    const alt = fileForShare(item, declared);
    if (alt) push(alt);
  }

  return out;
}

async function fileFromUrl(item: SaveableFile): Promise<File | null> {
  try {
    const res = await fetch(item.url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const type = iosShareMime(item.fileName, blob.type || item.mime);
    return new File([blob], item.fileName || 'file', { type });
  } catch {
    return null;
  }
}

function openBlobUrl(url: string): boolean {
  try {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch {
    return false;
  }
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

async function tryIosShare(item: SaveableFile): Promise<SaveReceivedFileResult> {
  if (typeof navigator.share !== 'function') return 'failed';

  let candidates = shareCandidates(item);
  if (!candidates.length) {
    const fetched = await fileFromUrl(item);
    if (!fetched) return 'failed';
    candidates = shareCandidates({ ...item, file: fetched });
  }

  for (const file of candidates) {
    const data: ShareData = { files: [file], title: item.fileName || 'file' };
    const canShare = !navigator.canShare || navigator.canShare(data);
    if (!canShare) continue;
    try {
      await navigator.share(data);
      return 'shared';
    } catch (err) {
      if (isAbortError(err)) return 'cancelled';
    }
  }

  // canShare is strict on iOS; try share anyway with the best candidate.
  const best = candidates[0];
  if (best) {
    try {
      await navigator.share({ files: [best], title: item.fileName || 'file' });
      return 'shared';
    } catch (err) {
      if (isAbortError(err)) return 'cancelled';
    }
  }

  return openBlobUrl(item.url) ? 'opened' : 'failed';
}

export async function saveReceivedFile(item: SaveableFile): Promise<SaveReceivedFileResult> {
  if (isIosDevice()) return tryIosShare(item);
  return triggerAnchorDownload(item) ? 'downloaded' : 'failed';
}

export async function saveBlobDownload(blob: Blob, fileName: string): Promise<SaveReceivedFileResult> {
  const url = URL.createObjectURL(blob);
  try {
    const mime = iosShareMime(fileName, blob.type || 'application/octet-stream');
    const file = new File([blob], fileName, { type: mime });
    return await saveReceivedFile({ fileName, url, mime, file });
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}
