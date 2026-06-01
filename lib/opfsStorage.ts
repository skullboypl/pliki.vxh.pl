import { inspectOriginCaches, type CacheQuotaInspect } from '@/lib/cacheQuotaInspect';

/** OPFS staging for incoming transfers — must be purged or origin quota fills up. */

/** Headroom above file size when checking quota (metadata, batch buffers). */
export const STORAGE_RECEIVE_MARGIN_BYTES = 48 * 1024 * 1024;

/**
 * MDN: StorageManager.estimate() — secure context only.
 * https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate
 *
 * MDN: potentially trustworthy = HTTPS, localhost, 127.0.0.1, *.localhost — not LAN IP.
 * https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts
 */
export type StorageApiBlockReason = 'insecure-context' | 'no-storage-api' | null;

export function hasOpfsSupport(): boolean {
  return !!(typeof navigator !== 'undefined' && navigator.storage?.getDirectory);
}

/** `estimate()` / OPFS need a secure context (`window.isSecureContext`). */
export function getStorageApiBlockReason(): StorageApiBlockReason {
  if (typeof window === 'undefined') return 'no-storage-api';
  if (!('storage' in navigator) || typeof navigator.storage?.estimate !== 'function') {
    return 'no-storage-api';
  }
  if (!window.isSecureContext) return 'insecure-context';
  return null;
}

export function isStorageEstimateAvailable(): boolean {
  return getStorageApiBlockReason() === null;
}

export function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = 'name' in err ? String((err as { name?: string }).name) : '';
  const message = 'message' in err ? String((err as { message?: string }).message) : '';
  return (
    name === 'QuotaExceededError' ||
    /quota/i.test(message) ||
    /exceed.*storage/i.test(message)
  );
}

export type StorageLocale = 'pl' | 'en';

/** Decimal (SI) steps — matches Chrome DevTools `Platform.NumberUtilities.bytesToString`. */
const STORAGE_UNIT = 1000;

function storageLocaleTag(locale: StorageLocale): string {
  return locale === 'pl' ? 'pl-PL' : 'en-US';
}

function formatStorageUnitValue(value: number, locale: StorageLocale, fractionDigits: number): string {
  const tag = storageLocaleTag(locale);
  if (value >= 100) {
    return Math.round(value).toLocaleString(tag, { maximumFractionDigits: 0 });
  }
  return value.toLocaleString(tag, {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  });
}

/**
 * Chrome DevTools → Application → Storage (PL: „Wykorzystane jest 1,2 MB z 625 719 MB…”).
 * Uses decimal KB/MB/GB/TB (×1000), same as DevTools — not binary MiB (×1024).
 */
export function formatStorageDevTools(bytes: number, locale: StorageLocale = 'pl'): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  const K = STORAGE_UNIT;
  const M = K * K;
  const G = M * K;
  const T = G * K;

  if (bytes < K) return `${bytes} B`;

  const kb = bytes / K;
  if (bytes < M) {
    return `${formatStorageUnitValue(kb, locale, kb < 10 ? 1 : 0)} KB`;
  }

  const mb = bytes / M;
  if (bytes < G) {
    return `${formatStorageUnitValue(mb, locale, mb < 10 ? 1 : 0)} MB`;
  }

  const gb = bytes / G;
  if (bytes < T) {
    return `${formatStorageUnitValue(gb, locale, gb < 10 ? 2 : gb < 100 ? 1 : 0)} GB`;
  }

  const tb = bytes / T;
  return `${formatStorageUnitValue(tb, locale, tb < 10 ? 2 : tb < 100 ? 1 : 0)} TB`;
}

/** Raw bytes for tooltip / debug (DevTools hover shows these too). */
export function formatStorageBytesExact(bytes: number, locale: StorageLocale = 'pl'): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0';
  return Math.round(bytes).toLocaleString(storageLocaleTag(locale));
}

/** @deprecated alias */
export const formatStorageDevtools = formatStorageDevTools;

export type StorageUsageDetails = {
  fileSystem: number;
  indexedDB: number;
  caches: number;
  serviceWorker: number;
};

export type StorageBudget = {
  usage: number;
  quota: number;
  available: number;
};

export type StorageQuotaSource =
  | 'estimate'
  | 'estimate-normalized'
  | 'webkit-temporary';

export type StorageSnapshot = StorageBudget & {
  persisted: boolean;
  details: StorageUsageDetails;
  detailsTotal: number;
  /** Sum of OPFS file sizes on disk (estimate.usage can lag behind). */
  opfsUsed: number;
  cache: CacheQuotaInspect;
  /** Raw `estimate().quota` from the browser (Chrome may break usage ≤ quota). */
  quotaRaw: number;
  /** Where `quota` came from after aligning with DevTools / webkit pool. */
  quotaSource: StorageQuotaSource;
  /**
   * Conservative usage for `available` / receive checks (OPFS on disk, breakdown).
   * `usage` matches DevTools → Application header.
   */
  usageEffective: number;
  /** Set when estimate() cannot run (insecure http://192.168… or missing API). */
  blockReason: StorageApiBlockReason;
};

/** Chromium extension on `StorageEstimate` (DevTools breakdown). */
type StorageEstimateWithDetails = StorageEstimate & {
  usageDetails?: Record<string, number>;
};

function parseUsageDetails(raw: StorageEstimateWithDetails['usageDetails']): StorageUsageDetails {
  const d = raw as Record<string, number> | undefined;
  if (!d) {
    return { fileSystem: 0, indexedDB: 0, caches: 0, serviceWorker: 0 };
  }
  return {
    fileSystem: Number(d.fileSystem ?? d.originPrivateFileSystem ?? 0) || 0,
    indexedDB: Number(d.indexedDB ?? 0) || 0,
    caches: Number(d.caches ?? 0) || 0,
    serviceWorker: Number(d.serviceWorkerRegistrations ?? d.serviceWorker ?? 0) || 0,
  };
}

export async function measureOpfsUsageBytes(): Promise<number> {
  if (!hasOpfsSupport()) return 0;
  let total = 0;
  try {
    const root = await navigator.storage.getDirectory();
    for await (const [, handle] of root as unknown as AsyncIterable<
      [string, FileSystemHandle]
    >) {
      if (handle.kind !== 'file') continue;
      try {
        const file = await (handle as FileSystemFileHandle).getFile();
        total += file.size;
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  return total;
}

/** Usage for free-space math: API + real OPFS on disk (whichever is higher). */
export function resolveUsageBytes(
  usageReported: number,
  opfsUsed: number,
  details: StorageUsageDetails,
): number {
  return Math.max(usageReported, details.fileSystem, opfsUsed);
}

export function bytesRequiredForReceive(fileBytes: number): number {
  return Math.max(0, fileBytes) + STORAGE_RECEIVE_MARGIN_BYTES;
}

type WebkitTemporaryStorage = {
  queryUsageAndQuota: (
    success: (usage: number, quota: number) => void,
    error?: (err: unknown) => void,
  ) => void;
};

/**
 * MDN: `usage` is out of `quota` (usage ≤ quota). Chrome sometimes returns
 * `quota === usage + pool`; DevTools shows `pool` only — subtract usage when obvious.
 */
export function normalizeChromePoolQuota(usage: number, quotaReported: number): number {
  if (!Number.isFinite(quotaReported) || quotaReported <= 0) return 0;
  if (quotaReported <= usage) return quotaReported;
  const pool = quotaReported - usage;
  if (pool >= 16 * 1024 * 1024) return pool;
  return quotaReported;
}

async function readWebkitTemporaryQuota(): Promise<{ usage: number; quota: number } | null> {
  const wt = (navigator as Navigator & { webkitTemporaryStorage?: WebkitTemporaryStorage })
    .webkitTemporaryStorage;
  if (!wt?.queryUsageAndQuota) return null;
  return new Promise((resolve) => {
    try {
      wt.queryUsageAndQuota(
        (usage, quota) => resolve({ usage, quota }),
        () => resolve(null),
      );
    } catch {
      resolve(null);
    }
  });
}

function pickEffectiveQuota(
  usage: number,
  quotaRaw: number,
  webkit: { usage: number; quota: number } | null,
): { quota: number; source: StorageQuotaSource } {
  const fromEstimate = normalizeChromePoolQuota(usage, quotaRaw);
  if (!webkit?.quota) {
    return {
      quota: fromEstimate,
      source: fromEstimate !== quotaRaw ? 'estimate-normalized' : 'estimate',
    };
  }
  const fromWebkit = normalizeChromePoolQuota(webkit.usage, webkit.quota);
  if (fromWebkit > 0 && (fromEstimate <= 0 || fromWebkit < fromEstimate)) {
    return { quota: fromWebkit, source: 'webkit-temporary' };
  }
  return {
    quota: fromEstimate,
    source: fromEstimate !== quotaRaw ? 'estimate-normalized' : 'estimate',
  };
}

/** Chrome DevTools → Application → Storage (webkit pool when available). */
function pickDevToolsUsageAndQuota(
  usageReported: number,
  quotaRaw: number,
  webkit: { usage: number; quota: number } | null,
): { usage: number; quota: number; quotaSource: StorageQuotaSource } {
  if (webkit && webkit.quota > 0) {
    const quota =
      normalizeChromePoolQuota(webkit.usage, webkit.quota) || webkit.quota;
    return { usage: webkit.usage, quota, quotaSource: 'webkit-temporary' };
  }
  const { quota, source } = pickEffectiveQuota(usageReported, quotaRaw, null);
  return { usage: usageReported, quota, quotaSource: source };
}

function emptyStorageSnapshot(
  cache: CacheQuotaInspect,
  opfsUsed: number,
  blockReason: StorageApiBlockReason,
): StorageSnapshot {
  const empty = { fileSystem: 0, indexedDB: 0, caches: 0, serviceWorker: 0 };
  return {
    usage: 0,
    quota: 0,
    available: 0,
    persisted: false,
    details: empty,
    detailsTotal: 0,
    opfsUsed,
    cache,
    quotaRaw: 0,
    quotaSource: 'estimate',
    usageEffective: 0,
    blockReason,
  };
}

export async function readStorageEstimate(): Promise<StorageSnapshot> {
  const cache = await inspectOriginCaches();
  const opfsUsed = await measureOpfsUsageBytes();
  const blockReason = getStorageApiBlockReason();
  if (blockReason) {
    return emptyStorageSnapshot(cache, opfsUsed, blockReason);
  }
  try {
    const [est, webkit] = await Promise.all([
      navigator.storage.estimate() as Promise<StorageEstimateWithDetails>,
      readWebkitTemporaryQuota(),
    ]);
    const usageReported = est.usage ?? 0;
    const quotaRaw = est.quota ?? 0;
    const details = parseUsageDetails(est.usageDetails);
    const detailsTotal =
      details.fileSystem + details.indexedDB + details.caches + details.serviceWorker;
    const persisted = await isStoragePersisted();
    const { usage, quota, quotaSource } = pickDevToolsUsageAndQuota(
      usageReported,
      quotaRaw,
      webkit,
    );
    const usageEffective = resolveUsageBytes(usageReported, opfsUsed, details);
    return {
      usage,
      quota,
      available: Math.max(0, quota - usageEffective),
      usageEffective,
      persisted,
      details,
      detailsTotal,
      opfsUsed,
      cache,
      quotaRaw,
      quotaSource,
      blockReason: null,
    };
  } catch {
    return emptyStorageSnapshot(cache, opfsUsed, 'no-storage-api');
  }
}

export async function getStorageBudget(): Promise<StorageBudget> {
  const snap = await readStorageEstimate();
  return { usage: snap.usage, quota: snap.quota, available: snap.available };
}

export async function isStoragePersisted(): Promise<boolean> {
  try {
    return !!(await navigator.storage?.persisted?.());
  } catch {
    return false;
  }
}

export async function getStorageSnapshot(): Promise<StorageSnapshot> {
  return readStorageEstimate();
}

/** iOS Safari (karta) — `estimate().quota` bywa ~10–40+ GB (udział dysku), nie realny limit witryny. */
export const IOS_SAFARI_TAB_QUOTA_DISPLAY_CAP = 2 * 1024 * 1024 * 1024;

/** Footnote when browser quota looks like free disk space (iOS Safari tab, Android Chrome). */
export function shouldShowInflatedBrowserQuotaNote(
  snap: Pick<StorageSnapshot, 'quota' | 'persisted'>,
  standalone: boolean,
): boolean {
  if (standalone || snap.persisted) return false;
  return snap.quota > IOS_SAFARI_TAB_QUOTA_DISPLAY_CAP;
}

/** @deprecated use shouldShowInflatedBrowserQuotaNote — iOS Safari tab only */
export function shouldShowIosSafariQuotaNote(
  snap: Pick<StorageSnapshot, 'quota' | 'persisted'>,
  ctx: { ios: boolean; standalone: boolean },
): boolean {
  if (!ctx.ios || ctx.standalone || snap.persisted) return false;
  return shouldShowInflatedBrowserQuotaNote(snap, ctx.standalone);
}

export function formatStorageBrief(
  snap: Pick<StorageSnapshot, 'usage' | 'quota' | 'opfsUsed' | 'details' | 'cache'>,
  locale: StorageLocale = 'pl',
): string {
  const opfs = formatStorageDevTools(Math.max(snap.details.fileSystem, snap.opfsUsed ?? 0), locale);
  const total = formatStorageDevTools(snap.usage, locale);
  const limit = formatStorageDevTools(snap.quota, locale);
  const free = formatStorageDevTools(Math.max(0, snap.quota - snap.usage), locale);
  let line = `zajęte ${total} / limit ${limit} (wolne ${free}) · OPFS ${opfs}`;
  if (snap.cache.opaqueCount > 0) {
    line += ` · Cache nieprzejrzyste ~${formatStorageDevTools(snap.cache.opaqueQuotaPaddingBytes, locale)}`;
  }
  return line;
}

/** `timestamp_originalName` from opfsOpenWriter in ShareApp. */
export function displayNameFromOpfsEntry(entryName: string): string {
  const sep = entryName.indexOf('_');
  if (sep < 0) return entryName;
  return entryName.slice(sep + 1) || entryName;
}

export type OpfsStoredEntry = {
  entryName: string;
  file: File;
};

/** List all OPFS staging files (survives page reload). */
export async function listOpfsStoredEntries(): Promise<OpfsStoredEntry[]> {
  if (!hasOpfsSupport()) return [];
  const out: OpfsStoredEntry[] = [];
  try {
    const root = await navigator.storage.getDirectory();
    for await (const [name, handle] of root as unknown as AsyncIterable<
      [string, FileSystemHandle]
    >) {
      if (handle.kind !== 'file') continue;
      try {
        const file = await (handle as FileSystemFileHandle).getFile();
        out.push({ entryName: name, file });
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  out.sort((a, b) => {
    const ta = Number(a.entryName.split('_')[0]) || 0;
    const tb = Number(b.entryName.split('_')[0]) || 0;
    return tb - ta;
  });
  return out;
}

export async function removeOpfsEntry(entryName: string): Promise<boolean> {
  if (!hasOpfsSupport() || !entryName) return false;
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(entryName);
    return true;
  } catch {
    return false;
  }
}

export type PurgeOpfsResult = {
  removed: number;
  removedNames: string[];
};

/** Delete OPFS files whose names are not in keepNames. */
export async function purgeOpfsStaging(
  keepNames: ReadonlySet<string> = new Set(),
): Promise<PurgeOpfsResult> {
  const removedNames: string[] = [];
  if (!hasOpfsSupport()) return { removed: 0, removedNames };

  try {
    const root = await navigator.storage.getDirectory();
    for await (const [name, handle] of root as unknown as AsyncIterable<
      [string, FileSystemHandle]
    >) {
      if (handle.kind !== 'file' || keepNames.has(name)) continue;
      try {
        await root.removeEntry(name);
        removedNames.push(name);
      } catch {
        /* ignore per-file */
      }
    }
  } catch {
    /* ignore */
  }
  return { removed: removedNames.length, removedNames };
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** persist() only in installed PWA — then quota follows real disk (e.g. ~60% in Chrome). */
export async function requestPersistentStorageIfPwa(standalone: boolean): Promise<boolean> {
  if (!standalone) return false;
  return requestPersistentStorage();
}

export type FreeStorageResult = {
  budget: StorageBudget;
  ok: boolean;
  required: number;
  purgedStaging: number;
  purgedDownloadNames: string[];
  persisted: boolean;
};

/**
 * Make room for an incoming file: purge OPFS, then check navigator.storage.estimate() quota.
 */
export async function freeStorageForIncoming(
  fileBytes: number,
  activeKeep: ReadonlySet<string>,
  standalone = false,
): Promise<FreeStorageResult> {
  const required = bytesRequiredForReceive(fileBytes);
  await requestPersistentStorageIfPwa(standalone);

  let purged = await purgeOpfsStaging(activeKeep);
  let snap = await readStorageEstimate();
  let budget: StorageBudget = {
    usage: snap.usage,
    quota: snap.quota,
    available: snap.available,
  };

  // Nie kasuj zapisanych odebranych plików — tylko wcześniejsze purge bez keepNames.

  const purgedDownloadNames = purged.removedNames.filter((n) => !activeKeep.has(n));

  return {
    budget,
    ok: required <= 0 || budget.quota === 0 || required <= budget.available,
    required,
    purgedStaging: purged.removed,
    purgedDownloadNames,
    persisted: snap.persisted,
  };
}

export function canStoreFile(budget: StorageBudget, fileBytes: number): boolean {
  if (!budget.quota) return true;
  return bytesRequiredForReceive(fileBytes) <= budget.available;
}
