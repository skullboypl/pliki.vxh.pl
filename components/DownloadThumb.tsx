'use client';

import { useEffect, useState } from 'react';

type ThumbLink = {
  url: string;
  fileName: string;
  mime: string;
  file?: File;
  size?: number;
};

type Props = {
  link: ThumbLink;
};

const MAX_TEXT_THUMB_BYTES = 512 * 1024;

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

export function isTextLink(link: ThumbLink) {
  const mt = (link.mime || '').toLowerCase();
  const name = (link.fileName || '').toLowerCase();
  if (!mt.startsWith('text/') && !/\.txt$/i.test(name)) return false;
  const size = link.size ?? link.file?.size ?? 0;
  return !size || size <= MAX_TEXT_THUMB_BYTES;
}

export function hasListThumb(link: ThumbLink) {
  return isImageLink(link) || isVideoLink(link) || isTextLink(link);
}

function snippetFromText(raw: string) {
  const plain = raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~`>|[\]()!-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.slice(0, 140) || '…';
}

function TextListThumb({ link }: { link: ThumbLink }) {
  const [snippet, setSnippet] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const text = link.file ? await link.file.text() : await (await fetch(link.url)).text();
        if (!cancelled) setSnippet(snippetFromText(text));
      } catch {
        if (!cancelled) setSnippet('');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [link.url, link.file]);

  if (snippet === null) {
    return <span className="download-thumb-text download-thumb-text-loading">···</span>;
  }

  return <span className="download-thumb-text">{snippet || '…'}</span>;
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

  if (isTextLink(link)) {
    return <TextListThumb link={link} />;
  }

  return null;
}
