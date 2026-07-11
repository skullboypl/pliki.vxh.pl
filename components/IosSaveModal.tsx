'use client';

import { useEffect, useState } from 'react';
import {
  canUseReceivedDownloadUrl,
  createReceivedDownloadPath,
  resolvedReceivedDownloadFileUrl,
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
    chooseHint: 'Wybierz sposób zapisu:',
    shareMethod: 'Udostępnij',
    shareMethodHint: 'Panel iOS, Zapisz w Plikach. Do ok. 80 MB.',
    downloadMethod: 'Pobierz linkiem',
    downloadMethodHint: 'Plik z pamięci aplikacji (OPFS). Dla dużych filmów.',
    largeHint: (size: string) =>
      `Plik ma ${size}. Udostępnij nie zadziała, użyj Pobierz linkiem lub Podgląd.`,
    largeSteps:
      'Jeśli Pobierz nie zadziała: Podgląd → pełny ekran → Udostępnij → Zapisz wideo.',
    preview: 'Otwórz podgląd',
    cancel: 'Anuluj',
    preparing: 'Przygotowuję link pobierania…',
    shareFailed: 'Panel zapisu się nie otworzył. Spróbuj Pobierz linkiem.',
    downloadUnavailable: 'Link pobierania niedostępny. Użyj Udostępnij.',
    close: 'Zamknij',
  },
  en: {
    title: 'Save file',
    chooseHint: 'Choose how to save:',
    shareMethod: 'Share',
    shareMethodHint: 'iOS sheet, Save to Files. Up to about 80 MB.',
    downloadMethod: 'Download via link',
    downloadMethodHint: 'File from app storage (OPFS). For large videos.',
    largeHint: (size: string) =>
      `This file is ${size}. Share will not work; use Download via link or Preview.`,
    largeSteps:
      'If download fails: Preview → fullscreen → Share → Save Video.',
    preview: 'Open preview',
    cancel: 'Cancel',
    preparing: 'Preparing download link…',
    shareFailed: 'Share sheet did not open. Try Download via link.',
    downloadUnavailable: 'Download link unavailable. Use Share.',
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
  const canShare = !tooLarge && !!(item.file || item.shareFile);

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
        const path = await createReceivedDownloadPath(item, lang);
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
  }, [canDownload, item.fileName, item.mime, item.opfsEntryName, item.size, lang]);

  const onShareClick = async () => {
    if (busy || tooLarge || !canShare) return;
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

  const downloadHref = downloadPath ? resolvedReceivedDownloadFileUrl(downloadPath) : null;
  const showMethodPicker = downloadReady && (canShare || downloadHref);

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

        {!downloadReady && canDownload ? (
          <p className="quota-modal__text">{t.preparing}</p>
        ) : tooLarge ? (
          <>
            <p className="quota-modal__text ios-save-modal__steps">{t.largeHint(formatSize(fileSize))}</p>
            <p className="quota-modal__text ios-save-modal__steps">{t.largeSteps}</p>
          </>
        ) : showMethodPicker ? (
          <p className="quota-modal__text">{t.chooseHint}</p>
        ) : null}

        <div className="ios-save-methods">
          {canShare ? (
            <button
              type="button"
              className="ios-save-method"
              disabled={busy || !downloadReady}
              onClick={() => void onShareClick()}
            >
              <span className="ios-save-method__title">{t.shareMethod}</span>
              <span className="ios-save-method__hint">{t.shareMethodHint}</span>
            </button>
          ) : null}

          {canDownload ? (
            downloadHref ? (
              <a
                href={downloadHref}
                target="_blank"
                rel="noopener noreferrer"
                download={item.fileName || 'file'}
                className="ios-save-method ios-save-method--link"
                onClick={() => finishDownloadTap()}
              >
                <span className="ios-save-method__title">{t.downloadMethod}</span>
                <span className="ios-save-method__hint">{t.downloadMethodHint}</span>
              </a>
            ) : downloadReady ? (
              <p className="ios-save-method ios-save-method--disabled" aria-disabled="true">
                <span className="ios-save-method__title">{t.downloadMethod}</span>
                <span className="ios-save-method__hint">{t.downloadUnavailable}</span>
              </p>
            ) : (
              <p className="ios-save-method ios-save-method--disabled" aria-disabled="true">
                <span className="ios-save-method__title">{t.downloadMethod}</span>
                <span className="ios-save-method__hint">{t.preparing}</span>
              </p>
            )
          ) : null}
        </div>

        <div className="quota-modal__actions ios-save-modal__actions">
          {tooLarge && onPreview ? (
            <button type="button" className="btn-ghost" onClick={openPreview}>
              {t.preview}
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
