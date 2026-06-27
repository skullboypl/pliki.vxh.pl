export type ObsPlayerSize =
  | { mode: 'auto' }
  | { mode: 'fixed'; width: number; height: number };

export type ObsSizePresetId =
  | 'auto'
  | '1920x1080'
  | '1280x720'
  | '2560x1440'
  | '3840x2160'
  | '1080x1920'
  | '720x1280'
  | 'custom';

export const OBS_SIZE_PRESETS: {
  id: ObsSizePresetId;
  labelPl: string;
  labelEn: string;
  w?: number;
  h?: number;
}[] = [
  { id: 'auto', labelPl: 'Auto (dopasuj do kamery)', labelEn: 'Auto (match camera)' },
  { id: '1920x1080', labelPl: '1920×1080 (Full HD)', labelEn: '1920×1080 (Full HD)', w: 1920, h: 1080 },
  { id: '1280x720', labelPl: '1280×720 (HD)', labelEn: '1280×720 (HD)', w: 1280, h: 720 },
  { id: '2560x1440', labelPl: '2560×1440 (QHD)', labelEn: '2560×1440 (QHD)', w: 2560, h: 1440 },
  { id: '3840x2160', labelPl: '3840×2160 (4K)', labelEn: '3840×2160 (4K)', w: 3840, h: 2160 },
  { id: '1080x1920', labelPl: '1080×1920 (pion)', labelEn: '1080×1920 (portrait)', w: 1080, h: 1920 },
  { id: '720x1280', labelPl: '720×1280 (pion HD)', labelEn: '720×1280 (portrait HD)', w: 720, h: 1280 },
  { id: 'custom', labelPl: 'Własna…', labelEn: 'Custom…' },
];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export const DEFAULT_OBS_WIDTH = 1920;
export const DEFAULT_OBS_HEIGHT = 1080;
export const DEFAULT_OBS_PLAYER: ObsPlayerSize = {
  mode: 'fixed',
  width: DEFAULT_OBS_WIDTH,
  height: DEFAULT_OBS_HEIGHT,
};

export function fixedObsDimensions(size: ObsPlayerSize): { width: number; height: number } {
  if (size.mode === 'fixed') return { width: size.width, height: size.height };
  return { width: DEFAULT_OBS_WIDTH, height: DEFAULT_OBS_HEIGHT };
}

export function resolveObsPlayerSize(
  presetId: ObsSizePresetId,
  customW: string,
  customH: string,
): ObsPlayerSize | null {
  if (presetId === 'auto') return { mode: 'auto' };
  if (presetId === 'custom') {
    const w = clamp(parseInt(customW, 10) || 0, 320, 7680);
    const h = clamp(parseInt(customH, 10) || 0, 240, 4320);
    if (!w || !h) return null;
    return { mode: 'fixed', width: w, height: h };
  }
  const preset = OBS_SIZE_PRESETS.find((p) => p.id === presetId);
  if (preset?.w && preset?.h) return { mode: 'fixed', width: preset.w, height: preset.h };
  return DEFAULT_OBS_PLAYER;
}

export function formatObsPlayerSize(size: ObsPlayerSize, lang: 'pl' | 'en'): string {
  if (size.mode === 'auto') return lang === 'pl' ? 'Auto' : 'Auto';
  return `${size.width}×${size.height}`;
}

/** Compact string for the self-contained OBS link, e.g. "auto" or "1920x1080". */
export function serializeObsPlayerSize(size: ObsPlayerSize): string {
  return size.mode === 'auto' ? 'auto' : `${size.width}x${size.height}`;
}

export function parseObsPlayerSizeString(raw: string | null | undefined): ObsPlayerSize {
  const s = (raw || '').trim().toLowerCase();
  if (s === 'auto') return { mode: 'auto' };
  const m = /^(\d{3,5})x(\d{3,5})$/.exec(s);
  if (m) {
    return {
      mode: 'fixed',
      width: clamp(parseInt(m[1], 10), 320, 7680),
      height: clamp(parseInt(m[2], 10), 240, 4320),
    };
  }
  return DEFAULT_OBS_PLAYER;
}
