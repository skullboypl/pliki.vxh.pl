'use client';

type ThumbLink = {
  url: string;
  fileName: string;
  mime: string;
};

type Props = {
  link: ThumbLink;
};

export function isImageLink(link: ThumbLink) {
  const mt = (link.mime || '').toLowerCase();
  if (mt.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(link.fileName || '');
}

export function isVideoLink(link: ThumbLink) {
  const mt = (link.mime || '').toLowerCase();
  if (mt.startsWith('video/')) return true;
  return /\.(mp4|webm|ogg|mov|m4v)$/i.test(link.fileName || '');
}

export function hasListThumb(link: ThumbLink) {
  return isImageLink(link) || isVideoLink(link);
}

export default function DownloadThumb({ link }: Props) {
  if (isImageLink(link)) {
    return (
      <img
        src={link.url}
        alt=""
        className="download-thumb-media"
        loading="lazy"
        decoding="async"
      />
    );
  }

  if (isVideoLink(link)) {
    return (
      <video
        src={link.url}
        className="download-thumb-media"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden
      />
    );
  }

  return null;
}
