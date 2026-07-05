'use client';

import { useState } from 'react';
import { shareFileOnIos, type SaveableFile } from '@/lib/saveReceivedFile';

type Lang = 'pl' | 'en';

const COPY = {
  pl: {
    title: 'Zapisz plik',
    hint: 'Dotknij „Pobierz”, potem wybierz Zapisz w Plikach lub Zapisz wideo.',
    download: 'Pobierz',
    share: 'Udostępnij…',
    cancel: 'Anuluj',
    shareFailed: 'Udostępnianie niedostępne. Użyj przycisku Pobierz.',
    close: 'Zamknij',
  },
  en: {
    title: 'Save file',
    hint: 'Tap Download, then choose Save to Files or Save Video.',
    download: 'Download',
    share: 'Share…',
    cancel: 'Cancel',
    shareFailed: 'Sharing unavailable. Use the Download button.',
    close: 'Close',
  },
} as const;

type Props = {
  lang: Lang;
  item: SaveableFile;
  onClose: () => void;
  onSaved: () => void;
};

export default function IosSaveModal({ lang, item, onClose, onSaved }: Props) {
  const t = COPY[lang];
  const [shareError, setShareError] = useState<string | null>(null);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const finishSaved = () => {
    onSaved();
    onClose();
  };

  const onShareClick = async () => {
    setShareError(null);
    const result = await shareFileOnIos(item);
    if (result === 'saved') {
      finishSaved();
      return;
    }
    if (result === 'cancelled') return;
    setShareError(t.shareFailed);
  };

  return (
    <div className="quota-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="quota-modal ios-save-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ios-save-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="quota-modal__header">
          <h2 id="ios-save-title" className="quota-modal__title">
            {t.title}
          </h2>
          <button type="button" className="icon-button close-button" aria-label={t.close} onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="quota-modal__file-name ios-save-modal__name">{item.fileName}</p>
        <p className="quota-modal__text">{t.hint}</p>
        <div className="quota-modal__actions ios-save-modal__actions">
          <a
            href={item.url}
            download={item.fileName || 'file'}
            className="btn-save"
            onClick={() => finishSaved()}
          >
            {t.download}
          </a>
          {canShare ? (
            <button type="button" className="btn-save btn-save-outline" onClick={() => void onShareClick()}>
              {t.share}
            </button>
          ) : null}
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t.cancel}
          </button>
        </div>
        {shareError ? (
          <p className="ios-save-modal__error" role="alert">
            {shareError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
