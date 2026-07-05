'use client';

import { useState } from 'react';
import { shareFileOnIos, type SaveableFile } from '@/lib/saveReceivedFile';

type Lang = 'pl' | 'en';

const COPY = {
  pl: {
    title: 'Zapisz plik',
    hint: 'Dotknij „Zapisz”, potem wybierz Zapisz w Plikach lub Zapisz wideo.',
    save: 'Zapisz',
    cancel: 'Anuluj',
    shareFailed:
      'Panel zapisu się nie otworzył. Zamknij PWA, otwórz ponownie i spróbuj jeszcze raz.',
    close: 'Zamknij',
  },
  en: {
    title: 'Save file',
    hint: 'Tap Save, then choose Save to Files or Save Video.',
    save: 'Save',
    cancel: 'Cancel',
    shareFailed: 'Save panel did not open. Close the PWA, reopen it, and try again.',
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
  const [busy, setBusy] = useState(false);

  const onSaveClick = async () => {
    if (busy) return;
    setShareError(null);
    setBusy(true);
    try {
      const result = await shareFileOnIos(item);
      if (result === 'saved') {
        onSaved();
        onClose();
        return;
      }
      if (result === 'cancelled') return;
      setShareError(t.shareFailed);
    } finally {
      setBusy(false);
    }
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
          <button type="button" className="btn-save" disabled={busy} onClick={() => void onSaveClick()}>
            {t.save}
          </button>
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
