'use client';

import { useEffect, useState } from 'react';

const BAR_COUNT = 14;
const MAX_WAVEFORM_BYTES = 3 * 1024 * 1024;

type Props = {
  url: string;
  file?: File;
  size?: number;
};

function fallbackHeights(seed: string): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    const v = Math.abs(Math.sin((h + i * 17) * 0.31)) * 0.55 + 0.2;
    return v;
  });
}

async function loadWaveformHeights(
  url: string,
  file?: File,
): Promise<number[] | null> {
  const bytes = file?.size ?? 0;
  if (bytes > MAX_WAVEFORM_BYTES) return null;

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = file ? await file.arrayBuffer() : await (await fetch(url)).arrayBuffer();
  } catch {
    return null;
  }

  const Ctx =
    typeof window !== 'undefined'
      ? window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined;
  if (!Ctx) return null;

  const ctx = new Ctx();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const data = audioBuffer.getChannelData(0);
    const block = Math.max(1, Math.floor(data.length / BAR_COUNT));
    const peaks: number[] = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      let peak = 0;
      const start = i * block;
      const end = Math.min(data.length, start + block);
      for (let j = start; j < end; j++) peak = Math.max(peak, Math.abs(data[j]));
      peaks.push(peak);
    }
    const max = Math.max(...peaks, 0.0001);
    return peaks.map((p) => Math.max(0.12, p / max));
  } catch {
    return null;
  } finally {
    void ctx.close();
  }
}

export default function AudioListThumb({ url, file, size }: Props) {
  const [heights, setHeights] = useState<number[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const byteSize = size ?? file?.size ?? 0;
      const sampled =
        byteSize > MAX_WAVEFORM_BYTES ? null : await loadWaveformHeights(url, file);
      if (cancelled) return;
      setHeights(sampled ?? fallbackHeights(url + (file?.name || '')));
    })();

    return () => {
      cancelled = true;
    };
  }, [url, file, size]);

  if (!heights) {
    return (
      <span className="download-thumb-audio download-thumb-audio--loading" aria-hidden>
        <span className="download-thumb-audio-bars">
          {Array.from({ length: BAR_COUNT }, (_, i) => (
            <span key={i} className="download-thumb-audio-bar" />
          ))}
        </span>
      </span>
    );
  }

  return (
    <span className="download-thumb-audio" aria-hidden>
      <span className="download-thumb-audio-bars">
        {heights.map((h, i) => (
          <span
            key={i}
            className="download-thumb-audio-bar"
            style={{ ['--h' as string]: String(h) }}
          />
        ))}
      </span>
      <span className="download-thumb-audio-icon" aria-hidden>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
        </svg>
      </span>
    </span>
  );
}
