'use client';

import { useEffect, useRef, useState } from 'react';
import { audioMime } from '@/lib/audioMedia';

type Props = {
  src: string;
  mime?: string;
  fileName: string;
};

const VIZ_BARS = 32;

export default function PreviewAudioPlayer({ src, mime, fileName }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas) return;

    const stopViz = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };

    const draw = () => {
      const analyser = analyserRef.current;
      const c = canvasRef.current;
      if (!analyser || !c) return;
      const g = c.getContext('2d');
      if (!g) return;

      const { width, height } = c;
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);

      g.clearRect(0, 0, width, height);
      const barW = width / VIZ_BARS;
      const gap = Math.max(1, barW * 0.22);

      for (let i = 0; i < VIZ_BARS; i++) {
        const idx = Math.floor((i / VIZ_BARS) * data.length);
        const v = data[idx] / 255;
        const barH = Math.max(4, v * height * 0.92);
        const x = i * barW + gap / 2;
        const y = (height - barH) / 2;
        g.fillStyle = i % 2 === 0 ? '#6cbe45' : '#4a9a32';
        g.fillRect(x, y, barW - gap, barH);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    const ensureAudioGraph = () => {
      if (sourceRef.current) return;
      try {
        const Ctx =
          window.AudioContext ||
          (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        const actx = new Ctx();
        const analyser = actx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.75;
        const source = actx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(actx.destination);
        ctxRef.current = actx;
        analyserRef.current = analyser;
        sourceRef.current = source;
      } catch {
        /* already connected or unsupported */
      }
    };

    const onPlay = () => {
      ensureAudioGraph();
      void ctxRef.current?.resume();
      stopViz();
      draw();
    };

    const onPause = () => {
      stopViz();
    };

    const onEnded = () => {
      stopViz();
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    setReady(true);

    return () => {
      stopViz();
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      try {
        sourceRef.current?.disconnect();
        analyserRef.current?.disconnect();
        void ctxRef.current?.close();
      } catch {
        /* ignore */
      }
      sourceRef.current = null;
      analyserRef.current = null;
      ctxRef.current = null;
    };
  }, [src, mime, fileName]);

  const type = audioMime(fileName, mime);

  return (
    <div className="preview-audio-wrap">
      <canvas
        ref={canvasRef}
        className="preview-audio-viz"
        width={640}
        height={120}
        aria-hidden
      />
      <audio
        ref={audioRef}
        className="preview-audio"
        controls
        preload="metadata"
        src={src}
        key={src}
      >
        <source src={src} type={type} />
      </audio>
      {!ready ? <p className="preview-audio-status">…</p> : null}
    </div>
  );
}
