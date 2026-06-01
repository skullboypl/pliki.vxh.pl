'use client';

import type { ZipEntryInfo } from '@/lib/zipEntryList';

type Lang = 'pl' | 'en';

const COPY = {
  pl: {
    title: 'Zawartość archiwum',
    loading: 'Odczyt listy plików…',
    empty: 'Archiwum jest puste.',
    close: 'Zamknij',
    files: (n: number) => (n === 1 ? '1 plik' : `${n} plików`),
    folderNote: 'Tylko lista nazw. Pliki nie są rozpakowywane w przeglądarce.',
    saveFile: 'Zapisz plik',
  },
  en: {
    title: 'Archive contents',
    loading: 'Reading file list…',
    empty: 'Archive is empty.',
    close: 'Close',
    files: (n: number) => (n === 1 ? '1 file' : `${n} files`),
    folderNote: 'File names only. Nothing is extracted in the browser.',
    saveFile: 'Save file',
  },
} as const;

function formatSize(bytes: number) {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

type Props = {
  lang: Lang;
  archiveName: string;
  entries: ZipEntryInfo[];
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave?: () => void;
};

export default function ZipContentsModal({
  lang,
  archiveName,
  entries,
  loading,
  error,
  onClose,
  onSave,
}: Props) {
  const t = COPY[lang];

  return (
    <div className="quota-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="quota-modal zip-contents-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="zip-contents-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="quota-modal__header">
          <h2 id="zip-contents-title" className="quota-modal__title">
            {t.title}
          </h2>
          <button type="button" className="icon-button close-button" aria-label={t.close} onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="zip-contents-modal__archive">{archiveName}</p>
        <p className="zip-contents-modal__note">{t.folderNote}</p>
        {loading ? (
          <p className="quota-modal__text">{t.loading}</p>
        ) : error ? (
          <p className="zip-contents-modal__error" role="alert">
            {error}
          </p>
        ) : entries.length === 0 ? (
          <p className="quota-modal__empty">{t.empty}</p>
        ) : (
          <>
            <p className="zip-contents-modal__count">{t.files(entries.length)}</p>
            <ul className="zip-contents-modal__list">
              {entries.map((entry) => (
                <li key={entry.path} className="zip-contents-modal__item">
                  <span className="zip-contents-modal__path">{entry.path}</span>
                  <span className="zip-contents-modal__size">
                    {entry.uncompressedSize > 0
                      ? formatSize(entry.uncompressedSize)
                      : entry.compressedSize > 0
                        ? formatSize(entry.compressedSize)
                        : ''}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="quota-modal__actions">
          {onSave ? (
            <button type="button" className="btn-save" onClick={onSave}>
              {t.saveFile}
            </button>
          ) : null}
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}
