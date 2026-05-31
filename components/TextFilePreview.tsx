'use client';

import { useEffect, useMemo, useState } from 'react';
import { IconCheck, IconCopy } from '@/components/icons';
import { renderNoteContent } from '@/lib/renderNoteContent';

const MAX_PREVIEW_BYTES = 512 * 1024;

type ViewMode = 'rendered' | 'source';

type Props = {
  url: string;
  file?: File;
  lang: 'pl' | 'en';
};

const COPY = {
  pl: {
    loading: 'Wczytywanie…',
    tooLarge: 'Plik jest za duży do podglądu — pobierz go na dysk.',
    empty: '(pusty plik)',
    error: 'Nie udało się odczytać pliku.',
    rendered: 'Podgląd',
    source: 'Źródło',
    copy: 'Kopiuj tekst',
    copied: 'Skopiowano',
    copyError: 'Nie udało się skopiować.',
  },
  en: {
    loading: 'Loading…',
    tooLarge: 'File is too large to preview — save it to disk.',
    empty: '(empty file)',
    error: 'Could not read the file.',
    rendered: 'Preview',
    source: 'Source',
    copy: 'Copy text',
    copied: 'Copied',
    copyError: 'Could not copy.',
  },
} as const;

export default function TextFilePreview({ url, file, lang }: Props) {
  const t = COPY[lang];
  const [state, setState] = useState<'loading' | 'ok' | 'error' | 'large'>('loading');
  const [text, setText] = useState('');
  const [view, setView] = useState<ViewMode>('rendered');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (file && file.size > MAX_PREVIEW_BYTES) {
          if (!cancelled) setState('large');
          return;
        }

        const body = file ? await file.text() : await (await fetch(url)).text();
        if (cancelled) return;

        if (!file && body.length > MAX_PREVIEW_BYTES) {
          setState('large');
          return;
        }

        setText(body || (lang === 'pl' ? '(pusty plik)' : '(empty file)'));
        setState('ok');
      } catch {
        if (!cancelled) setState('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, file, lang]);

  const renderedHtml = useMemo(() => {
    if (state !== 'ok' || !text.trim()) return '';
    try {
      return renderNoteContent(text);
    } catch {
      return '';
    }
  }, [state, text]);

  const copyText = async () => {
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
      window.setTimeout(() => setCopyError(false), 3000);
    }
  };

  if (state === 'loading') return <p className="preview-text-status">{t.loading}</p>;
  if (state === 'large') return <p className="preview-text-status">{t.tooLarge}</p>;
  if (state === 'error') return <p className="preview-text-status preview-text-error">{t.error}</p>;

  return (
    <div className="preview-text-wrap">
      <div className="preview-text-toolbar">
        <div className="preview-text-tabs" role="tablist" aria-label={t.rendered}>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'rendered'}
            className={`preview-text-tab${view === 'rendered' ? ' is-active' : ''}`}
            onClick={() => setView('rendered')}
          >
            {t.rendered}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'source'}
            className={`preview-text-tab${view === 'source' ? ' is-active' : ''}`}
            onClick={() => setView('source')}
          >
            {t.source}
          </button>
        </div>
        <button
          type="button"
          className={`preview-text-copy${copied ? ' is-success' : ''}${copyError ? ' is-error' : ''}`}
          onClick={copyText}
        >
          {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
          <span>{copied ? t.copied : copyError ? t.copyError : t.copy}</span>
        </button>
      </div>

      {view === 'rendered' ? (
        <div
          className="preview-rich-text"
          dangerouslySetInnerHTML={{ __html: renderedHtml || renderNoteContent(text) }}
        />
      ) : (
        <pre className="preview-text">{text}</pre>
      )}
    </div>
  );
}
