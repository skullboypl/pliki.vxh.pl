export type SaveableFile = {
  fileName: string;
  url: string;
  mime: string;
  file?: File;
  shareFile?: File;
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

/**
 * MDN shareable video extensions: .mp4 / .m4v only (not .mov).
 * https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share#shareable_file_types
 */
function iosShareFileName(fileName: string): string {
  const ext = fileExtension(fileName);
  if (ext === '.mov') {
    const base = fileName.slice(0, -ext.length);
    return `${base}.mp4`;
  }
  return fileName;
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

/** Prepare a shareable File copy while the blob is still in memory (sync, no extra RAM). */
export function prepareShareFile(file: File, fileName: string, mime: string): File {
  const shareName = iosShareFileName(fileName || file.name || 'file');
  const shareMime = iosShareMime(shareName, file.type || mime);
  const blob = file.slice(0, file.size, shareMime);
  return new File([blob], shareName, {
    type: shareMime,
    lastModified: file.lastModified ?? Date.now(),
  });
}

function buildShareFile(item: SaveableFile, mime: string): File | null {
  const source = item.file;
  if (!source) return null;
  const shareName = iosShareFileName(item.fileName || source.name || 'file');
  if (item.shareFile && item.shareFile.name === shareName && item.shareFile.type === mime) {
    return item.shareFile;
  }
  return prepareShareFile(source, item.fileName || source.name || 'file', mime);
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

function shareMimeCandidates(item: SaveableFile): string[] {
  const shareName = iosShareFileName(item.fileName);
  const declared = item.file?.type || item.mime;
  return [iosShareMime(shareName, declared)];
}

/**
 * iOS PWA: Web Share with { files } only (no title/text).
 * See: https://stackoverflow.com/questions/69288906
 */
export async function shareFileOnIos(item: SaveableFile): Promise<SaveReceivedFileResult> {
  if (typeof navigator.share !== 'function') return 'failed';

  const tryShare = async (file: File) => {
    if (navigator.canShare && !navigator.canShare({ files: [file] })) return 'failed' as const;
    await navigator.share({ files: [file] });
    return 'saved' as const;
  };

  if (item.shareFile) {
    try {
      return await tryShare(item.shareFile);
    } catch (err) {
      if (isAbortError(err)) return 'cancelled';
    }
  }

  for (const mime of shareMimeCandidates(item)) {
    const file = buildShareFile(item, mime);
    if (!file) continue;
    try {
      return await tryShare(file);
    } catch (err) {
      if (isAbortError(err)) return 'cancelled';
    }
  }

  return 'failed';
}

export async function saveReceivedFile(item: SaveableFile): Promise<SaveReceivedFileResult> {
  if (isIosDevice()) return shareFileOnIos(item);
  return triggerAnchorDownload(item) ? 'saved' : 'failed';
}

export async function saveBlobDownload(blob: Blob, fileName: string): Promise<SaveReceivedFileResult> {
  const mime = iosShareMime(fileName, blob.type || 'application/octet-stream');
  const file = new File([blob], fileName, { type: mime });
  const shareFile = prepareShareFile(file, fileName, mime);
  const url = URL.createObjectURL(blob);
  try {
    return await saveReceivedFile({ fileName, url, mime, file, shareFile });
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
