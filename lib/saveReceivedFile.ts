export type SaveableFile = {
  fileName: string;
  url: string;
  mime: string;
  size?: number;
  file?: File;
  shareFile?: File;
  opfsEntryName?: string;
};

export type SaveReceivedFileResult = 'saved' | 'cancelled' | 'failed' | 'too_large';

/**
 * iOS WebKit often crashes navigator.share above ~50-100 MB (soft limit).
 * MeTube uses 80 MB pre-flight: https://github.com/alexta69/metube/commit/6ff364a
 */
export const IOS_SHARE_MAX_BYTES = 80 * 1024 * 1024;

export function iosShareFileSize(item: Pick<SaveableFile, 'file' | 'size'>): number {
  return item.file?.size ?? item.size ?? 0;
}

export function isIosShareTooLarge(sizeBytes: number): boolean {
  return sizeBytes > IOS_SHARE_MAX_BYTES;
}

/** iOS Web Share MIME for generic non-media types. */
const IOS_SHARE_MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
};

/**
 * Audio extensions → iOS-shareable name + MIME.
 * MDN: .flac, .m4a (audio/x-m4a), .mp3, .oga, .ogg, .opus, .wav, .weba
 * https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share#shareable_file_types
 */
const IOS_AUDIO_SHARE_BY_EXT: Record<string, { shareExt: string; shareMime: string }> = {
  '.mp3': { shareExt: '.mp3', shareMime: 'audio/mpeg' },
  '.m4a': { shareExt: '.m4a', shareMime: 'audio/x-m4a' },
  '.wav': { shareExt: '.wav', shareMime: 'audio/wav' },
  '.flac': { shareExt: '.flac', shareMime: 'audio/flac' },
  '.ogg': { shareExt: '.ogg', shareMime: 'audio/ogg' },
  '.oga': { shareExt: '.oga', shareMime: 'audio/ogg' },
  '.opus': { shareExt: '.opus', shareMime: 'audio/ogg' },
  '.weba': { shareExt: '.weba', shareMime: 'audio/webm' },
  '.aac': { shareExt: '.m4a', shareMime: 'audio/x-m4a' },
  '.aif': { shareExt: '.wav', shareMime: 'audio/wav' },
  '.aiff': { shareExt: '.wav', shareMime: 'audio/wav' },
  '.wma': { shareExt: '.mp3', shareMime: 'audio/mpeg' },
  '.mid': { shareExt: '.mp3', shareMime: 'audio/mpeg' },
  '.midi': { shareExt: '.mp3', shareMime: 'audio/mpeg' },
};

/**
 * Video extensions → iOS-shareable name + MIME.
 * MDN: .mp4, .m4v, .mpeg, .mpg, .ogm, .ogv, .webm
 */
const IOS_VIDEO_SHARE_BY_EXT: Record<string, { shareExt: string; shareMime: string }> = {
  '.mp4': { shareExt: '.mp4', shareMime: 'video/mp4' },
  '.m4v': { shareExt: '.m4v', shareMime: 'video/mp4' },
  '.mov': { shareExt: '.mp4', shareMime: 'video/mp4' },
  '.webm': { shareExt: '.webm', shareMime: 'video/webm' },
  '.ogv': { shareExt: '.ogv', shareMime: 'video/ogg' },
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

function isAudioExtension(ext: string): boolean {
  return ext in IOS_AUDIO_SHARE_BY_EXT;
}

function isVideoFile(fileName: string, mime: string): boolean {
  if (mime.startsWith('video/')) return true;
  const ext = fileExtension(fileName);
  return isVideoExtension(ext) && !mime.startsWith('audio/');
}

function isAudioFile(fileName: string, mime: string): boolean {
  if (mime.startsWith('audio/')) return true;
  const ext = fileExtension(fileName);
  return isAudioExtension(ext);
}

function pushShareTarget(
  out: Array<{ name: string; mime: string }>,
  seen: Set<string>,
  name: string,
  shareMime: string,
) {
  const key = `${name.toLowerCase()}\0${shareMime}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push({ name, mime: shareMime });
}

function videoShareTargets(fileName: string, mime: string): Array<{ name: string; mime: string }> {
  const ext = fileExtension(fileName);
  const base = fileBaseName(fileName) || 'file';
  const out: Array<{ name: string; mime: string }> = [];
  const seen = new Set<string>();

  const mapped = IOS_VIDEO_SHARE_BY_EXT[ext];
  if (mapped) pushShareTarget(out, seen, `${base}${mapped.shareExt}`, mapped.shareMime);

  if (mime === 'video/quicktime') pushShareTarget(out, seen, `${base}.mp4`, 'video/mp4');
  else if (mime.startsWith('video/')) {
    pushShareTarget(out, seen, `${base}.mp4`, mime === 'video/x-m4v' ? 'video/mp4' : mime);
  }

  pushShareTarget(out, seen, `${base}.mp4`, 'video/mp4');
  return out;
}

function audioShareTargets(fileName: string, mime: string): Array<{ name: string; mime: string }> {
  const ext = fileExtension(fileName);
  const base = fileBaseName(fileName) || 'file';
  const out: Array<{ name: string; mime: string }> = [];
  const seen = new Set<string>();

  const mapped = IOS_AUDIO_SHARE_BY_EXT[ext];
  if (mapped) pushShareTarget(out, seen, `${base}${mapped.shareExt}`, mapped.shareMime);

  const mt = mime.toLowerCase();
  if (mt === 'audio/mp4' || mt === 'audio/x-m4a') {
    pushShareTarget(out, seen, `${base}.m4a`, 'audio/x-m4a');
  } else if (mt === 'audio/mp3' || mt === 'audio/mpeg') {
    pushShareTarget(out, seen, `${base}.mp3`, 'audio/mpeg');
  } else if (mt.startsWith('audio/')) {
    pushShareTarget(out, seen, `${base}.mp3`, mt);
    pushShareTarget(out, seen, `${base}.m4a`, 'audio/x-m4a');
  }

  pushShareTarget(out, seen, `${base}.mp3`, 'audio/mpeg');
  return out;
}

/** Display name stays original; share name may remap extension for iOS. */
export function iosShareFileName(fileName: string, mime = ''): string {
  const ext = fileExtension(fileName);
  const base = fileBaseName(fileName);

  if (isAudioFile(fileName, mime) && isAudioExtension(ext)) {
    return `${base}${IOS_AUDIO_SHARE_BY_EXT[ext].shareExt}`;
  }
  if (isVideoExtension(ext)) {
    return `${base}${IOS_VIDEO_SHARE_BY_EXT[ext].shareExt}`;
  }
  return fileName;
}

/** iOS Web Share MIME from extension or declared type. */
export function iosShareMime(fileName: string, mime: string): string {
  const ext = fileExtension(fileName);
  const audioMapped = IOS_AUDIO_SHARE_BY_EXT[ext];
  if (audioMapped && isAudioFile(fileName, mime)) return audioMapped.shareMime;

  const videoMapped = IOS_VIDEO_SHARE_BY_EXT[ext];
  if (videoMapped) return videoMapped.shareMime;

  const fromExt = IOS_SHARE_MIME_BY_EXT[ext];
  if (fromExt) return fromExt;

  const mt = mime.toLowerCase();
  if (mt === 'audio/mp4') return 'audio/x-m4a';
  if (mt === 'audio/mp3') return 'audio/mpeg';
  if (mt === 'video/quicktime' || mt === 'video/x-m4v') return 'video/mp4';
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
  if (isAudioFile(fileName, mime)) return audioShareTargets(fileName, mime);
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

  if (item.shareFile) {
    push(item.shareFile);
    return files;
  }

  const targets = shareTargetsForFile(item.fileName || source.name || 'file', declared);
  if (targets[0]) push(makeShareFile(source, targets[0].name, targets[0].mime));
  return files;
}

function downloadUrlForItem(item: SaveableFile): { url: string; revokeAfterMs?: number } {
  if (item.file) {
    return { url: URL.createObjectURL(item.file), revokeAfterMs: 60_000 };
  }
  return { url: item.url };
}

function triggerAnchorDownload(item: SaveableFile): boolean {
  try {
    const { url, revokeAfterMs } = downloadUrlForItem(item);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.fileName || 'file';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (revokeAfterMs) {
      window.setTimeout(() => URL.revokeObjectURL(url), revokeAfterMs);
    }
    return true;
  } catch {
    return false;
  }
}

function isAbortError(err: unknown): boolean {
  return !!err && typeof err === 'object' && 'name' in err && (err as { name?: string }).name === 'AbortError';
}

/** iOS PWA: Web Share with { files } only (no title/text). */
export async function shareFileOnIos(item: SaveableFile): Promise<SaveReceivedFileResult> {
  if (isIosShareTooLarge(iosShareFileSize(item))) return 'too_large';
  if (typeof navigator.share !== 'function') return 'failed';

  const candidates = shareFileCandidates(item);
  const file = candidates[0];
  if (!file || !canShareFile(file)) return 'failed';

  try {
    await navigator.share({ files: [file] });
    return 'saved';
  } catch (err) {
    if (isAbortError(err)) return 'cancelled';
    return 'failed';
  }
}

export async function saveReceivedFile(item: SaveableFile): Promise<SaveReceivedFileResult> {
  if (isIosDevice()) return shareFileOnIos(item);
  return triggerAnchorDownload(item) ? 'saved' : 'failed';
}

/** Desktop: sync save in click handler (keeps user gesture for anchor download). */
export function saveReceivedFileDesktop(item: SaveableFile): SaveReceivedFileResult {
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
