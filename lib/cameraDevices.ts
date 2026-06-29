import { LAN_VIDEO_FRAMERATE } from '@/lib/webrtcCameraQuality';

export type CameraFacing = 'front' | 'back' | 'ultra' | 'tele' | 'other';

export type VideoInputDevice = {
  deviceId: string;
  label: string;
  facing: CameraFacing;
};

const guessFacing = (label: string): CameraFacing => {
  const l = label.toLowerCase();
  if (/ultra|0\.5x|0,5x|wide angle|szerok|ultrawide/.test(l)) return 'ultra';
  if (/tele|zoom|2x|3x|5x|peryskop/.test(l)) return 'tele';
  if (/back|rear|environment|tyl|tyln|rear-facing|facing back|world/.test(l)) return 'back';
  if (/front|user|selfie|przed|przód|face time|facetime/.test(l)) return 'front';
  return 'other';
};

const FACING_LABELS = {
  pl: { front: 'Przednia', back: 'Tylna', ultra: 'Szeroki kąt', tele: 'Teleobiektyw', other: 'Kamera' },
  en: { front: 'Front', back: 'Back', ultra: 'Ultra-wide', tele: 'Telephoto', other: 'Camera' },
} as const;

export const formatCameraLabel = (device: VideoInputDevice, lang: 'pl' | 'en', index: number): string => {
  const raw = device.label.trim();
  if (raw && !/^camera\s*\d*$/i.test(raw) && raw.length > 2) return raw;
  const base = FACING_LABELS[lang][device.facing];
  return `${base}${index > 0 ? ` ${index + 1}` : ''}`;
};

export async function listVideoInputDevices(): Promise<VideoInputDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  const inputs = all.filter((d) => d.kind === 'videoinput' && d.deviceId);
  return inputs.map((d) => ({
    deviceId: d.deviceId,
    label: d.label || '',
    facing: guessFacing(d.label || ''),
  }));
};

export const displayVideoDeviceLabel = (
  devices: VideoInputDevice[],
  deviceId: string,
  lang: 'pl' | 'en',
): string => {
  const device = devices.find((d) => d.deviceId === deviceId);
  if (!device) return lang === 'pl' ? 'Kamera' : 'Camera';
  const sameFacing = devices.filter((d) => d.facing === device.facing);
  const index = sameFacing.findIndex((d) => d.deviceId === deviceId);
  return formatCameraLabel(device, lang, Math.max(0, index));
};

export type VideoConstraintOpts = {
  deviceId?: string;
  facingMode?: 'user' | 'environment';
};

export const buildVideoConstraints = (opts?: VideoConstraintOpts): MediaTrackConstraints => {
  const quality = {
    width: { ideal: 1920, max: 3840 },
    height: { ideal: 1080, max: 2160 },
    frameRate: { ideal: 30, max: LAN_VIDEO_FRAMERATE },
  };
  if (opts?.deviceId) {
    return { ...quality, deviceId: { exact: opts.deviceId } };
  }
  if (opts?.facingMode) {
    return { ...quality, facingMode: { ideal: opts.facingMode } };
  }
  return { ...quality, facingMode: { ideal: 'user' } };
};

export const buildVideoConstraintsFallback = (): MediaTrackConstraints => ({
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  frameRate: { ideal: 30 },
});

export const findDeviceForFacing = (
  devices: VideoInputDevice[],
  facing: 'front' | 'back',
): VideoInputDevice | undefined => {
  const want = facing === 'front' ? 'front' : 'back';
  return devices.find((d) => d.facing === want);
};
