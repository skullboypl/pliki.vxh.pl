'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPlayer } from '@videojs/react';
import { Video, VideoSkin, videoFeatures } from '@videojs/react/video';
import '@videojs/react/video/skin.css';

const Player = createPlayer({ features: videoFeatures });

function videoMime(fileName: string, mime?: string, fileType?: string) {
  if (fileType?.startsWith('video/')) return fileType;
  if (mime?.startsWith('video/')) return mime;
  const name = fileName.toLowerCase();
  if (name.endsWith('.webm')) return 'video/webm';
  if (name.endsWith('.ogg') || name.endsWith('.ogv')) return 'video/ogg';
  if (name.endsWith('.mov')) return 'video/quicktime';
  if (name.endsWith('.m4v')) return 'video/x-m4v';
  if (name.endsWith('.mkv')) return 'video/x-matroska';
  return 'video/mp4';
}

type Props = {
  src: string;
  mime?: string;
  fileName?: string;
  fileType?: string;
  errorMessage: string;
};

export default function PreviewVideoPlayer({
  src,
  mime,
  fileName = '',
  fileType,
  errorMessage,
}: Props) {
  const [failed, setFailed] = useState(false);
  const [fsNonce, setFsNonce] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const type = videoMime(fileName, mime, fileType);

  const isCoarsePointer = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  }, []);

  useEffect(() => {
    setFailed(false);
  }, [src, type]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const video = wrap.querySelector('video') as HTMLVideoElement | null;
    if (!video) return;

    const onEndedFs = () => {
      // iOS Safari sometimes refuses to re-enter fullscreen after exiting unless the
      // media element is re-initialized. Remounting is a safe, low-impact fix.
      setFsNonce((n) => n + 1);
    };

    const onFsChange = () => {
      // When using the Fullscreen API, exiting should restore ability to enter again.
      // Remount on exit to keep behavior consistent across iOS/Android.
      if (!document.fullscreenElement) setFsNonce((n) => n + 1);
    };

    video.addEventListener('webkitendfullscreen', onEndedFs as EventListener);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      video.removeEventListener('webkitendfullscreen', onEndedFs as EventListener);
      document.removeEventListener('fullscreenchange', onFsChange);
    };
  }, [src, type]);

  const enterNativeFullscreen = async () => {
    const wrap = wrapRef.current;
    const video = wrap?.querySelector('video') as HTMLVideoElement | null;
    if (!video) return;

    // Android/desktop Fullscreen API
    const el = video as HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
      requestFullscreen?: (opts?: unknown) => Promise<void>;
    };

    try {
      if (typeof el.requestFullscreen === 'function') {
        await el.requestFullscreen({ navigationUI: 'hide' } as unknown);
        return;
      }
    } catch {
      // fall through to iOS-only API
    }

    // iOS Safari native fullscreen
    try {
      if (typeof el.webkitEnterFullscreen === 'function') {
        el.webkitEnterFullscreen();
      }
    } catch {
      /* ignore */
    }
  };

  if (failed) {
    return (
      <div className="preview-video-wrap" ref={wrapRef}>
        <p className="preview-video-error" role="alert">
          {errorMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="preview-video-wrap" ref={wrapRef}>
      {isCoarsePointer ? (
        <button
          type="button"
          className="preview-video-fsbtn"
          onClick={() => void enterNativeFullscreen()}
          aria-label="Fullscreen"
        >
          ⤢
        </button>
      ) : null}
      <Player.Provider key={`${src}:${fsNonce}`}>
        <VideoSkin className="preview-video-player">
          <Video
            src={src}
            playsInline
            preload="metadata"
            onError={() => setFailed(true)}
          >
            <source src={src} type={type} />
          </Video>
        </VideoSkin>
      </Player.Provider>
    </div>
  );
}
