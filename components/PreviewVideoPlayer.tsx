'use client';

import { createPlayer } from '@videojs/react';
import { Video, VideoSkin, videoFeatures } from '@videojs/react/video';
import '@videojs/react/video/skin.css';

const Player = createPlayer({ features: videoFeatures });

function videoMime(src: string, mime?: string) {
  if (mime?.startsWith('video/')) return mime;
  const name = src.toLowerCase();
  if (name.includes('.webm')) return 'video/webm';
  if (name.includes('.ogg')) return 'video/ogg';
  if (name.includes('.mov')) return 'video/quicktime';
  if (name.includes('.m4v')) return 'video/x-m4v';
  return 'video/mp4';
}

type Props = {
  src: string;
  mime?: string;
  fileName?: string;
};

export default function PreviewVideoPlayer({ src, mime, fileName }: Props) {
  const type = videoMime(fileName || src, mime);

  return (
    <div className="preview-video-wrap">
      <Player.Provider key={src}>
        <VideoSkin className="preview-video-player">
          <Video src={src} playsInline preload="metadata">
            <source src={src} type={type} />
          </Video>
        </VideoSkin>
      </Player.Provider>
    </div>
  );
}
