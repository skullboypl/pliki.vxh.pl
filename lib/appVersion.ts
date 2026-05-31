/** App release fingerprint — must match between HTML, /api/build-id and localStorage. */
export const APP_FINGERPRINT_KEY = 'vxh_app_fingerprint';
export const BOOT_RELOAD_KEY = 'vxh_boot_reload';
export const LEGACY_BUILD_KEY = 'vxh_build_id';

export type AppVersionInfo = {
  buildId: string;
  version: string;
  fingerprint: string;
};

export function formatFingerprint(buildId: string, version: string): string {
  return `${buildId}@${version}`;
}

export function parseFingerprint(raw: string | null | undefined): AppVersionInfo | null {
  if (!raw) return null;
  const at = raw.lastIndexOf('@');
  if (at <= 0) return null;
  const buildId = raw.slice(0, at);
  const version = raw.slice(at + 1);
  if (!buildId || !version) return null;
  return { buildId, version, fingerprint: raw };
}

export function fingerprintsMatch(stored: string | null, current: string | null): boolean {
  return !!stored && !!current && stored === current;
}

export function needsAssetRefresh(stored: string | null, current: string | null): boolean {
  if (!current) return false;
  if (!stored) return false;
  return stored !== current;
}
