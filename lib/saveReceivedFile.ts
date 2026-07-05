export type SaveableFile = {
  fileName: string;
  url: string;
  mime: string;
  file?: File;
  shareFile?: File;
};

export type SaveReceivedFileResult = 'saved' | 'cancelled' | 'failed';

/** iOS Web Share MIME for non-video types. */
const IOS_SHARE_MIME_BY_EXT: Record<string, string> = {
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

/**
 * Video extensions → iOS-shareable name + MIME.
 * MDN list: .mp4, .m4v, .mpeg, .mpg, .ogm, .ogv, .webm
 * https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share#shareable_file_types
 * Others (.mov, .mkv, .avi…) remap to .mp4 for share; preview keeps original name/type.
 */
const IOS_VIDEO_SHARE_BY_EXT: Record<string, { shareExt: string; shareMime: string }> = {
  '.mp4': { shareExt: '.mp4', shareMime: 'video/mp4' },
  '.m4v': { shareExt: '.m4v', shareMime: 'video/mp4' },
  '.mov': { shareExt: '.mp4', shareMime: 'video/mp4' },
  '.webm': { shareExt: '.webm', shareMime: 'video/webm' },
  '.ogv': { shareExt: '.ogv', shareMime: 'video/ogg' },
  '.ogg': { shareExt: '.ogv', shareMime: 'video/ogg' },
  '.ogm': { shareExt: '.ogm', shareMime: 'video/ogg' },
  '.mpeg': { shareExt: '.mpeg', shareMime: 'video/mpeg' },
  '.mpg': { shareExt: '.mpg', shareMime: 'video/mpeg' },
  '.mkv': { shareExt: '.mp4', shareMime: 'video/mp4' },
  '.avi': { shareExt: '.mp4', shareMime: 'video/mp4' },
  '.3gp': { shareExt: '.mp4', shareMime: 'video/mp4' },
  '.3g2': { shareExt: '.mp4', shareMime: 'video/mp4' },
  '.ts': { shareExt: '.mp4', shareMime: 'video/mp4' },
  '.mts': { shareExt: '.mp4', shareMime: 'video/mp4' },
};

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot).toLowerCase() : '';
}

function fileBaseName(name: string): string {
  const ext = fileExtension(name);
  return ext ? name.slice(0, -ext.length) : name;
}

function isVideoExtension(ext: string): boolean {
  return ext in IOS_VIDEO_SHARE_BY_EXT;
}

function isVideoFile(fileName: string, mime: string): boolean {
  const ext = fileExtension(fileName);
  if (isVideoExtension(ext)) return true;
  return mime.startsWith('video/');
}

function videoShareTargets(fileName: string, mime: string): Array<{ name: string; mime: string }> {
  const ext = fileExtension(fileName);
  const base = fileBaseName(fileName) || 'file';
  const out: Array<{ name: string; mime: string }> = [];
  const seen = new Set<string>();

  const push = (name: string, shareMime: string) => {
    const key = `${name.toLowerCase()}\0${shareMime}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ name, mime: shareMime });
  };

  const mapped = IOS_VIDEO_SHARE_BY_EXT[ext];
  if (mapped) push(`${base}${mapped.shareExt}`, mapped.shareMime);

  if (mime === 'video/quicktime') push(`${base}.mp4`, 'video/mp4');
  else if (mime.startsWith('video/')) push(`${base}.mp4`, mime === 'video/x-m4v' ? 'video/mp4' : mime);

  push(`${base}.mp4`, 'video/mp4');
  return out;
}

/** Display name stays original; share name may remap extension for iOS. */
export function iosShareFileName(fileName: string, mime = ''): string {
  const ext = fileExtension(fileName);
  if (isVideoExtension(ext)) {
    const base = fileBaseName(fileName);
    const mapped = IOS_VIDEO_SHARE_BY_EXT[ext];
    return `${base}${mapped.shareExt}`;
  }
  return fileName;
}

/** iOS Web Share MIME from extension or declared type. */
export function iosShareMime(fileName: string, mime: string): string {
  const ext = fileExtension(fileName);
  const videoMapped = IOS_VIDEO_SHARE_BY_EXT[ext];
  if (videoMapped) return videoMapped.shareMime;

  const fromExt = IOS_SHARE_MIME_BY_EXT[ext];
  if (fromExt) return fromExt;

  if (mime === 'video/quicktime' || mime === 'video/x-m4v') return 'video/mp4';
  if (!mime || mime === 'application/octet-stream') return mime || 'application/octet-stream';
  return mime;
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  const win = typeof window !== 'undefined' ? (window as Window & { MSStream?: unknown }) : undefined;
  return /iphone|ipad|ipod/.test(ua) && !win?.MSStream;
}

function canShareFile(file: File): boolean {
  return typeof navigator === 'undefined' || !navigator.canShare || navigator.canShare({ files: [file] });
}

function makeShareFile(source: File, name: string, mime: string): File {
  const blob = source.slice(0, source.size, mime);
  return new File([blob], name, {
    type: mime,
    lastModified: source.lastModified ?? Date.now(),
  });
}

function shareTargetsForFile(fileName: string, mime: string): Array<{ name: string; mime: string }> {
  if (isVideoFile(fileName, mime)) return videoShareTargets(fileName, mime);
  return [{ name: fileName, mime: iosShareMime(fileName, mime) }];
}

/** Prepare the best iOS-shareable File (sync, no extra RAM). */
export function prepareShareFile(file: File, fileName: string, mime: string): File {
  const declared = file.type || mime;
  for (const target of shareTargetsForFile(fileName || file.name || 'file', declared)) {
    const candidate = makeShareFile(file, target.name, target.mime);
    if (canShareFile(candidate)) return candidate;
  }
  const fallback = shareTargetsForFile(fileName || file.name || 'file', declared)[0];
  return makeShareFile(file, fallback.name, fallback.mime);
}

function buildShareFile(item: SaveableFile, name: string, mime: string): File | null {
  const source = item.file;
  if (!source) return null;
  return makeShareFile(source, name, mime);
}

function shareFileCandidates(item: SaveableFile): File[] {
  const source = item.file;
  if (!source) return item.shareFile ? [item.shareFile] : [];

  const declared = source.type || item.mime;
  const files: File[] = [];
  const seen = new Set<string>();

  const push = (file: File) => {
    const key = `${file.name.toLowerCase()}\0${file.type}`;
    if (seen.has(key)) return;
    seen.add(key);
    files.push(file);
  };

  if (item.shareFile) push(item.shareFile);

  for (const target of shareTargetsForFile(item.fileName || source.name || 'file', declared)) {
    push(makeShareFile(source, target.name, target.mime));
  }

  return files;
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
 * iOS PWA: Web Share with { files } only (no title/text).
 */
export async function shareFileOnIos(item: SaveableFile): Promise<SaveReceivedFileResult> {
  if (typeof navigator.share !== 'function') return 'failed';

  for (const file of shareFileCandidates(item)) {
    if (!canShareFile(file)) continue;
    try {
      await navigator.share({ files: [file] });
      return 'saved';
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
