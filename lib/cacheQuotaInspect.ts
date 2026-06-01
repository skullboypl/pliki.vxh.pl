/**
 * Chrome quota for opaque Cache API responses — see DevTools PWA docs:
 * https://developer.chrome.com/docs/devtools/progressive-web-apps#opaque-responses
 */
export const CHROME_OPAQUE_QUOTA_PADDING_BYTES = 7 * 1024 * 1024;

export type CacheQuotaInspect = {
  supported: boolean;
  storeNames: string[];
  entryCount: number;
  opaqueCount: number;
  /** ~7 MB × opaque entries — counted toward navigator.storage.usage in Chrome */
  opaqueQuotaPaddingBytes: number;
};

export const EMPTY_CACHE_INSPECT: CacheQuotaInspect = {
  supported: false,
  storeNames: [],
  entryCount: 0,
  opaqueCount: 0,
  opaqueQuotaPaddingBytes: 0,
};

const emptyInspect = (): CacheQuotaInspect => ({ ...EMPTY_CACHE_INSPECT });

/** Enumerate Cache Storage and count opaque responses (quota padding in Chrome). */
export async function inspectOriginCaches(): Promise<CacheQuotaInspect> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return emptyInspect();
  }
  try {
    const storeNames = await caches.keys();
    let entryCount = 0;
    let opaqueCount = 0;
    for (const name of storeNames) {
      const cache = await caches.open(name);
      const requests = await cache.keys();
      for (const req of requests) {
        entryCount += 1;
        try {
          const res = await cache.match(req);
          if (res?.type === 'opaque') opaqueCount += 1;
        } catch {
          /* ignore per-entry */
        }
      }
    }
    return {
      supported: true,
      storeNames,
      entryCount,
      opaqueCount,
      opaqueQuotaPaddingBytes: opaqueCount * CHROME_OPAQUE_QUOTA_PADDING_BYTES,
    };
  } catch {
    return emptyInspect();
  }
}

export async function clearAllOriginCaches(): Promise<number> {
  if (typeof window === 'undefined' || !('caches' in window)) return 0;
  const keys = await caches.keys();
  await Promise.all(keys.map((k) => caches.delete(k)));
  return keys.length;
}
