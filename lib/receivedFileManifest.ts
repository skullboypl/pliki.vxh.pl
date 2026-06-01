/** Persists receive metadata for OPFS files (survives page reload) — per PWA vs browser tab. */

import { getClientSurface, type ClientSurface } from '@/lib/clientSurface';

const LEGACY_STORAGE_KEY = 'vxh_received_manifest_v1';
const MAX_ENTRIES = 400;

export type ReceivedFileManifestEntry = {
  opfsEntryName: string;
  peerName: string;
  peerId?: string;
  receivedAt: number;
  fileName: string;
  mime?: string;
  size?: number;
  batchId?: string;
  batchIndex?: number;
  batchTotal?: number;
};

type Manifest = Record<string, ReceivedFileManifestEntry>;

function storageKey(surface: ClientSurface = getClientSurface()): string {
  return surface === 'pwa' ? 'vxh_received_manifest_v1_pwa' : 'vxh_received_manifest_v1_browser';
}

function readManifest(surface: ClientSurface = getClientSurface()): Manifest {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(storageKey(surface));
    if (raw) {
      const parsed = JSON.parse(raw) as Manifest;
      return parsed && typeof parsed === 'object' ? parsed : {};
    }
    if (surface === 'browser') {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy) as Manifest;
        const manifest = parsed && typeof parsed === 'object' ? parsed : {};
        writeManifest(manifest, surface);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return manifest;
      }
    }
    return {};
  } catch {
    return {};
  }
}

function writeManifest(manifest: Manifest, surface: ClientSurface = getClientSurface()): void {
  if (typeof localStorage === 'undefined') return;
  const keys = Object.keys(manifest);
  if (keys.length > MAX_ENTRIES) {
    keys
      .sort((a, b) => manifest[a].receivedAt - manifest[b].receivedAt)
      .slice(0, keys.length - MAX_ENTRIES)
      .forEach((k) => delete manifest[k]);
  }
  try {
    localStorage.setItem(storageKey(surface), JSON.stringify(manifest));
  } catch {
    /* quota — ignore */
  }
}

export function getReceivedFileManifest(
  opfsEntryName: string,
): ReceivedFileManifestEntry | null {
  return readManifest()[opfsEntryName] ?? null;
}

export function saveReceivedFileManifest(entry: ReceivedFileManifestEntry): void {
  const manifest = readManifest();
  manifest[entry.opfsEntryName] = entry;
  writeManifest(manifest);
}

export function removeReceivedFileManifest(opfsEntryName: string): void {
  const manifest = readManifest();
  if (!manifest[opfsEntryName]) return;
  delete manifest[opfsEntryName];
  writeManifest(manifest);
}

export function pruneReceivedFileManifest(keepOpfsNames: ReadonlySet<string>): void {
  const manifest = readManifest();
  let changed = false;
  for (const key of Object.keys(manifest)) {
    if (!keepOpfsNames.has(key)) {
      delete manifest[key];
      changed = true;
    }
  }
  if (changed) writeManifest(manifest);
}

export function clearReceivedFileManifest(surface: ClientSurface = getClientSurface()): void {
  writeManifest({}, surface);
}
