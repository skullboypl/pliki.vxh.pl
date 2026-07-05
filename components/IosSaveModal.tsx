'use client';

import { useState } from 'react';
import {
  iosShareFileSize,
  isIosShareTooLarge,
  shareFileOnIos,
  type SaveableFile,
} from '@/lib/saveReceivedFile';

type Lang = 'pl' | 'en';

function formatSize(bytes: number) {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const COPY = {
  pl: {
    title: 'Zapisz plik',
    hint: 'Dotknij „Zapisz”, potem wybierz Zapisz w Plikach lub Zapisz wideo.',
    largeHint: (size: string) =>
      `Plik ma ${size}. iPhone w PWA nie zapisze tak dużego pliku przez Udostępnij (limit pamięci Safari, ok. 80 MB).`,
    largeSteps:
      'Użyj Podgląd → pełny ekran → ikona Udostępnij w odtwarzaczu iOS → Zapisz wideo / Zapisz w Plikach.',
    preview: 'Otwórz podgląd',
    save: 'Zapisz',
    cancel: 'Anuluj',
    shareFailed:
      'Panel zapisu się nie otworzył. Spróbuj Podgląd i zapis z pełnego ekranu.',
    close: 'Zamknij',
  },
  en: {
    title: 'Save file',
    hint: 'Tap Save, then choose Save to Files or Save Video.',
    largeHint: (size: string) =>
      `This file is ${size}. iPhone PWA cannot save it via Share (Safari memory limit, about 80 MB).`,
    largeSteps:
      'Use Preview → fullscreen → iOS player Share icon → Save Video / Save to Files.',
    preview: 'Open preview',
    save: 'Save',
    cancel: 'Cancel',
    shareFailed: 'Save panel did not open. Try Preview and save from fullscreen.',
    close: 'Close',
  },
} as const;

type Props = {
  lang: Lang;
  item: SaveableFile;
  onClose: () => void;
  onSaved: () => void;
  onPreview?: () => void;
};

export default function IosSaveModal({ lang, item, onClose, onSaved, onPreview }: Props) {
  const t = COPY[lang];
  const [shareError, setShareError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileSize = iosShareFileSize(item);
  const tooLarge = isIosShareTooLarge(fileSize);

  const onSaveClick = async () => {
    if (busy || tooLarge) return;
    setShareError(null);
    setBusy(true);
    try {
      const result = await shareFileOnIos(item);
      if (result === 'saved') {
        onSaved();
        onClose();
        return;
      }
      if (result === 'cancelled' || result === 'too_large') return;
      setShareError(t.shareFailed);
    } finally {
      setBusy(false);
    }
  };

  const openPreview = () => {
    onPreview?.();
    onClose();
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
        {tooLarge ? (
          <>
            <p className="quota-modal__text">{t.largeHint(formatSize(fileSize))}</p>
            <p className="quota-modal__text ios-save-modal__steps">{t.largeSteps}</p>
          </>
        ) : (
          <p className="quota-modal__text">{t.hint}</p>
        )}
        <div className="quota-modal__actions ios-save-modal__actions">
          {tooLarge ? (
            onPreview ? (
              <button type="button" className="btn-save" onClick={openPreview}>
                {t.preview}
              </button>
            ) : null
          ) : (
            <button type="button" className="btn-save" disabled={busy} onClick={() => void onSaveClick()}>
              {t.save}
            </button>
          )}
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
