/** Persists receive metadata for OPFS files (survives page reload). */

const STORAGE_KEY = 'vxh_received_manifest_v1';
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

function readManifest(): Manifest {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Manifest;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeManifest(manifest: Manifest): void {
  if (typeof localStorage === 'undefined') return;
  const keys = Object.keys(manifest);
  if (keys.length > MAX_ENTRIES) {
    keys
      .sort((a, b) => manifest[a].receivedAt - manifest[b].receivedAt)
      .slice(0, keys.length - MAX_ENTRIES)
      .forEach((k) => delete manifest[k]);
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(manifest));
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

export function clearReceivedFileManifest(): void {
  writeManifest({});
}
