import { STORAGE_RECEIVE_MARGIN_BYTES, hasOpfsSupport } from '@/lib/opfsStorage';

/** User-facing transfer size guidance (must match receive/send logic in ShareApp). */

/** Receive without OPFS (RAM buffer) — above this we log a warning. */
export const RECEIVE_RAM_LIMIT_MOBILE = 128 * 1024 * 1024;
export const RECEIVE_RAM_LIMIT_DESKTOP = 512 * 1024 * 1024;

/** Below this, picked files are cloned into RAM before send; larger files stream from disk. */
export const SEND_CLONE_IN_MEMORY_MAX = 64 * 1024 * 1024;

export function receiveRamLimitBytes(mobile: boolean): number {
  return mobile ? RECEIVE_RAM_LIMIT_MOBILE : RECEIVE_RAM_LIMIT_DESKTOP;
}

/** Max incoming file size we can accept now (navigator.storage.estimate). */
export function effectiveReceiveCapBytes(
  available: number,
  quota: number,
  mobile: boolean,
): number {
  const ram = receiveRamLimitBytes(mobile);
  if (!hasOpfsSupport()) {
    return quota > 0 ? Math.min(ram, Math.max(0, available)) : ram;
  }
  if (!quota) return Number.MAX_SAFE_INTEGER;
  return Math.max(0, available - STORAGE_RECEIVE_MARGIN_BYTES);
}

export function fileLimitMessageVars(): Record<string, string> {
  return {
    ramMobileMb: String(RECEIVE_RAM_LIMIT_MOBILE / (1024 * 1024)),
    ramDesktopMb: String(RECEIVE_RAM_LIMIT_DESKTOP / (1024 * 1024)),
    sendStreamMb: String(SEND_CLONE_IN_MEMORY_MAX / (1024 * 1024)),
  };
}
