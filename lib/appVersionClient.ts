'use client';

import {
  APP_FINGERPRINT_KEY,
  LEGACY_BUILD_KEY,
  fingerprintsMatch,
  formatFingerprint,
  needsAssetRefresh,
  type AppVersionInfo,
} from '@/lib/appVersion';

export async function clearStaleBrowserCaches(): Promise<void> {
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((reg) => reg.unregister()));
  }
}

export function readEmbeddedFingerprint(): string | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector('meta[name="vxh-app-version"]')?.getAttribute('content') ?? null;
}

export async function fetchAppVersion(): Promise<AppVersionInfo | null> {
  const res = await fetch(`/api/build-id?t=${Date.now()}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Partial<AppVersionInfo>;
  if (!data.buildId || !data.version) return null;
  return {
    buildId: data.buildId,
    version: data.version,
    fingerprint: data.fingerprint ?? formatFingerprint(data.buildId, data.version),
  };
}

export async function syncAppVersionIfStale(): Promise<'ok' | 'reloading'> {
  const stored = localStorage.getItem(APP_FINGERPRINT_KEY);
  const embedded = readEmbeddedFingerprint();
  const info = embedded
    ? {
        buildId: embedded.split('@')[0] ?? '',
        version: embedded.split('@').slice(1).join('@') ?? '',
        fingerprint: embedded,
      }
    : await fetchAppVersion();

  if (!info?.fingerprint) return 'ok';

  const legacy = localStorage.getItem(LEGACY_BUILD_KEY);
  const legacyMismatch = !stored && legacy && legacy !== info.buildId;

  if (fingerprintsMatch(stored, info.fingerprint) && !legacyMismatch) {
    return 'ok';
  }

  if (!needsAssetRefresh(stored, info.fingerprint) && !legacyMismatch) {
    localStorage.setItem(APP_FINGERPRINT_KEY, info.fingerprint);
    localStorage.removeItem(LEGACY_BUILD_KEY);
    return 'ok';
  }

  localStorage.setItem(APP_FINGERPRINT_KEY, info.fingerprint);
  localStorage.removeItem(LEGACY_BUILD_KEY);
  await clearStaleBrowserCaches();
  window.location.reload();
  return 'reloading';
}
