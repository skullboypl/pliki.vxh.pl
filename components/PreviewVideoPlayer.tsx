'use client';

import { useEffect, useState } from 'react';
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
  const type = videoMime(fileName, mime, fileType);

  useEffect(() => {
    setFailed(false);
  }, [src, type]);

  if (failed) {
    return (
      <div className="preview-video-wrap">
        <p className="preview-video-error" role="alert">
          {errorMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="preview-video-wrap">
      <Player.Provider key={src}>
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
