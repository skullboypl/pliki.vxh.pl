/** Ustawienia jakości kamery / WebRTC pod LAN (bez sztywnego limitu MB). */

export const LAN_VIDEO_BITRATE = 12_000_000;
export const LAN_VIDEO_FRAMERATE = 60;

/** Preferuj max rozdzielczość kamery — przeglądarka wybierze najlepsze dostępne. */
export const CAMERA_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1920, max: 3840 },
  height: { ideal: 1080, max: 2160 },
  frameRate: { ideal: 30, max: LAN_VIDEO_FRAMERATE },
  facingMode: { ideal: 'user' },
};

export const CAMERA_VIDEO_CONSTRAINTS_FALLBACK: MediaTrackConstraints = {
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  frameRate: { ideal: 30 },
};

/** Po addTrack — maksymalny bitrate i bez skalowania w dół. */
export async function tuneSenderForLan(sender: RTCRtpSender): Promise<void> {
  const track = sender.track;
  if (!track || track.kind !== 'video') return;

  if ('contentHint' in track) {
    try {
      (track as MediaStreamTrack & { contentHint: string }).contentHint = 'detail';
    } catch {
      /* ignore */
    }
  }

  const params = sender.getParameters();
  if (!params.encodings?.length) params.encodings = [{}];

  params.encodings[0] = {
    ...params.encodings[0],
    maxBitrate: LAN_VIDEO_BITRATE,
    maxFramerate: LAN_VIDEO_FRAMERATE,
    scaleResolutionDownBy: 1,
  };

  const p = params as RTCRtpParameters & { degradationPreference?: string };
  p.degradationPreference = 'maintain-resolution';

  try {
    await sender.setParameters(params);
  } catch {
    /* niektóre przeglądarki odrzucają część pól — spróbuj bez degradationPreference */
    delete p.degradationPreference;
    try {
      await sender.setParameters(params);
    } catch {
      /* ignore */
    }
  }
}

export async function tuneAllVideoSenders(pc: RTCPeerConnection): Promise<void> {
  await Promise.all(pc.getSenders().map((s) => tuneSenderForLan(s)));
}
