import { APP_FINGERPRINT_KEY, LEGACY_BUILD_KEY } from '@/lib/appVersion';

export const LEGACY_PWA_SESSION_KEY = 'vxh_legacy_cache_cleaned_v1';

export async function purgeLegacyPwa(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  let changed = false;

  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    if (regs.length) {
      await Promise.all(regs.map((reg) => reg.unregister()));
      changed = true;
    }
  }

  if ('caches' in window) {
    const keys = await caches.keys();
    if (keys.length) {
      await Promise.all(keys.map((key) => caches.delete(key)));
      changed = true;
    }
  }

  sessionStorage.removeItem(LEGACY_PWA_SESSION_KEY);
  return changed;
}

/** One-time migration for tabs stuck on pre-boot-script builds. */
export function needsLegacyFingerprintMigration(): boolean {
  if (typeof window === 'undefined') return false;
  return !localStorage.getItem(APP_FINGERPRINT_KEY) && !!localStorage.getItem(LEGACY_BUILD_KEY);
}
