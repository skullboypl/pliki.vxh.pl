'use client';

import { useEffect, useState } from 'react';
import { listZipEntries, type ZipEntryInfo } from '@/lib/zipEntryList';

type Lang = 'pl' | 'en';

type Props = {
  url: string;
  file?: File;
  size?: number;
  lang: Lang;
};

function basename(path: string) {
  const i = path.lastIndexOf('/');
  return i >= 0 ? path.slice(i + 1) : path;
}

function shortName(name: string, max = 11) {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

export function zipThumbLines(entries: ZipEntryInfo[], lang: Lang): string[] {
  if (!entries.length) return [lang === 'pl' ? 'pusto' : 'empty'];
  const count = entries.length;
  const head =
    lang === 'pl'
      ? count === 1
        ? '1 plik'
        : `${count} plików`
      : count === 1
        ? '1 file'
        : `${count} files`;
  const names = entries.slice(0, 3).map((e) => shortName(basename(e.path)));
  return [head, ...names];
}

export default function ZipListThumb({ url, file, size, lang }: Props) {
  const [lines, setLines] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const source = file ?? url;
        const entries = await listZipEntries(source, size ?? file?.size);
        if (!cancelled) setLines(zipThumbLines(entries, lang));
      } catch {
        if (!cancelled) setLines(['ZIP']);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, file, size, lang]);

  if (lines === null) {
    return <span className="download-thumb-zip download-thumb-zip-loading">···</span>;
  }

  return (
    <span className="download-thumb-zip">
      <span className="download-thumb-zip-badge" aria-hidden>
        ZIP
      </span>
      {lines.map((line, i) => (
        <span
          key={`${i}-${line}`}
          className={i === 0 ? 'download-thumb-zip-count' : 'download-thumb-zip-name'}
        >
          {line}
        </span>
      ))}
    </span>
  );
}
