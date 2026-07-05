'use client';

import { useEffect, useState } from 'react';
import {
  canUseReceivedDownloadUrl,
  createReceivedDownloadPath,
  type ReceivedDownloadSource,
} from '@/lib/receivedDownload';
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
    downloadHint: 'Dotknij „Pobierz”. Plik poleci jak zwykłe pobieranie z internetu.',
    shareHint: 'Dotknij „Zapisz”, potem wybierz Zapisz w Plikach.',
    largeHint: (size: string) =>
      `Plik ma ${size}. Udostępnij nie zadziała, użyj Pobierz lub Podgląd.`,
    largeSteps:
      'Jeśli Pobierz nie zadziała: Podgląd → pełny ekran → Udostępnij → Zapisz wideo.',
    download: 'Pobierz',
    preview: 'Otwórz podgląd',
    save: 'Zapisz',
    cancel: 'Anuluj',
    preparing: 'Przygotowuję link…',
    shareFailed: 'Panel zapisu się nie otworzył. Użyj Pobierz lub Podgląd.',
    close: 'Zamknij',
  },
  en: {
    title: 'Save file',
    downloadHint: 'Tap Download. The file saves like a normal web download.',
    shareHint: 'Tap Save, then choose Save to Files.',
    largeHint: (size: string) =>
      `This file is ${size}. Share will not work; use Download or Preview.`,
    largeSteps:
      'If Download fails: Preview → fullscreen → Share → Save Video.',
    download: 'Download',
    preview: 'Open preview',
    save: 'Save',
    cancel: 'Cancel',
    preparing: 'Preparing link…',
    shareFailed: 'Save panel did not open. Use Download or Preview.',
    close: 'Close',
  },
} as const;

type Props = {
  lang: Lang;
  item: SaveableFile & ReceivedDownloadSource;
  onClose: () => void;
  onSaved: () => void;
  /** SW stream download: do not purge OPFS until the file has been served. */
  onDownloadTap?: () => void;
  onPreview?: () => void;
};

export default function IosSaveModal({ lang, item, onClose, onSaved, onDownloadTap, onPreview }: Props) {
  const t = COPY[lang];
  const [shareError, setShareError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloadPath, setDownloadPath] = useState<string | null>(null);
  const [downloadReady, setDownloadReady] = useState(false);

  const fileSize = iosShareFileSize(item);
  const tooLarge = isIosShareTooLarge(fileSize);
  const canDownload = canUseReceivedDownloadUrl(item);

  useEffect(() => {
    let cancelled = false;
    if (!canDownload) {
      setDownloadPath(null);
      setDownloadReady(true);
      return;
    }
    setDownloadReady(false);
    void (async () => {
      try {
        const path = await createReceivedDownloadPath(item);
        if (!cancelled) setDownloadPath(path);
      } catch {
        if (!cancelled) setDownloadPath(null);
      } finally {
        if (!cancelled) setDownloadReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canDownload, item.fileName, item.mime, item.opfsEntryName, item.size]);

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

  const finishDownloadTap = () => {
    onDownloadTap?.();
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

        {!downloadReady ? (
          <p className="quota-modal__text">{t.preparing}</p>
        ) : downloadPath ? (
          <>
            <p className="quota-modal__text">{t.downloadHint}</p>
            {tooLarge ? (
              <p className="quota-modal__text ios-save-modal__steps">{t.largeHint(formatSize(fileSize))}</p>
            ) : null}
          </>
        ) : tooLarge ? (
          <>
            <p className="quota-modal__text">{t.largeHint(formatSize(fileSize))}</p>
            <p className="quota-modal__text ios-save-modal__steps">{t.largeSteps}</p>
          </>
        ) : (
          <p className="quota-modal__text">{t.shareHint}</p>
        )}

        <div className="quota-modal__actions ios-save-modal__actions">
          {downloadReady && downloadPath ? (
            <>
              <a
                href={downloadPath}
                download={item.fileName || 'file'}
                className="btn-save"
                onClick={() => finishDownloadTap()}
              >
                {t.download}
              </a>
              {tooLarge && onPreview ? (
                <button type="button" className="btn-ghost" onClick={openPreview}>
                  {t.preview}
                </button>
              ) : null}
            </>
          ) : downloadReady && tooLarge && onPreview ? (
            <button type="button" className="btn-save" onClick={openPreview}>
              {t.preview}
            </button>
          ) : downloadReady ? (
            <button type="button" className="btn-save" disabled={busy} onClick={() => void onSaveClick()}>
              {t.save}
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
