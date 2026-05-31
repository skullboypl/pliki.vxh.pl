import { zipSync } from 'fflate';
import type { ReceivedFile } from '@/components/ReceivedFilesList';

async function fileBytes(link: ReceivedFile): Promise<Uint8Array> {
  if (link.file) return new Uint8Array(await link.file.arrayBuffer());
  const res = await fetch(link.url);
  if (!res.ok) throw new Error(`fetch failed: ${link.fileName}`);
  return new Uint8Array(await res.arrayBuffer());
}

function sanitizeZipPart(value: string) {
  return value
    .trim()
    .replace(/[^\w\s.-]+/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40) || 'paczka';
}

export function bundleZipName(links: ReceivedFile[]) {
  const peer = sanitizeZipPart(links[0]?.peerName || 'paczka');
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  return `${peer}-${stamp}.zip`;
}

export function uniqueEntryNames(links: ReceivedFile[]): string[] {
  const used = new Map<string, number>();
  return links.map((link) => {
    const raw = (link.fileName || 'file').replace(/[/\\]+/g, '_').trim() || 'file';
    const key = raw.toLowerCase();
    const count = used.get(key) ?? 0;
    used.set(key, count + 1);
    if (count === 0) return raw;
    const dot = raw.lastIndexOf('.');
    if (dot > 0) return `${raw.slice(0, dot)} (${count + 1})${raw.slice(dot)}`;
    return `${raw} (${count + 1})`;
  });
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

export async function downloadBundleAsZip(links: ReceivedFile[], zipName?: string) {
  if (!links.length) return;
  const names = uniqueEntryNames(links);
  const entries: Record<string, Uint8Array> = {};
  for (let i = 0; i < links.length; i += 1) {
    entries[names[i]] = await fileBytes(links[i]);
  }
  const zipped = zipSync(entries);
  const blob = new Blob([zipped], { type: 'application/zip' });
  triggerDownload(blob, zipName || bundleZipName(links));
}

export function downloadAllFiles(
  links: ReceivedFile[],
  onEach: (link: ReceivedFile) => void,
  gapMs = 120,
) {
  links.forEach((link, i) => {
    window.setTimeout(() => onEach(link), i * gapMs);
  });
}
