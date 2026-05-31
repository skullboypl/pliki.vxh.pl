'use client';

import { useEffect, useState } from 'react';
import { fileFromPastedImage } from '@/lib/textNote';

type Lang = 'pl' | 'en';

const COPY = {
  pl: {
    placeholder: 'lub wklej ze schowka (tekst/obraz)',
    send: 'Wyślij',
    imageTitle: 'Obraz ze schowka',
    imageSend: 'Wyślij obraz',
    cancel: 'Anuluj',
    empty: 'Wpisz lub wklej treść.',
  },
  en: {
    placeholder: 'or paste from clipboard (text/image)',
    send: 'Send',
    imageTitle: 'Image from clipboard',
    imageSend: 'Send image',
    cancel: 'Cancel',
    empty: 'Type or paste something first.',
  },
} as const;

type PendingImage = {
  file: File;
  url: string;
};

type Props = {
  lang: Lang;
  disabled?: boolean;
  onSendText: (text: string) => void;
  onSendFile: (file: File) => void;
};

export default function PeerQuickSend({ lang, disabled, onSendText, onSendFile }: Props) {
  const t = COPY[lang];
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);

  const revokeImage = (entry: PendingImage | null) => {
    if (entry?.url) URL.revokeObjectURL(entry.url);
  };

  useEffect(() => {
    return () => revokeImage(pendingImage);
  }, [pendingImage]);

  const clearPendingImage = () => {
    setPendingImage((prev) => {
      revokeImage(prev);
      return null;
    });
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!item.type.startsWith('image/')) continue;
      const blob = item.getAsFile();
      if (!blob?.size) continue;
      e.preventDefault();
      setPendingImage((prev) => {
        revokeImage(prev);
        return {
          file: fileFromPastedImage(blob, item.type),
          url: URL.createObjectURL(blob),
        };
      });
      setError('');
      return;
    }
  };

  const sendText = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError(t.empty);
      return;
    }
    onSendText(trimmed);
    setText('');
    setError('');
  };

  const sendImage = () => {
    if (!pendingImage) return;
    onSendFile(pendingImage.file);
    clearPendingImage();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      sendText();
    }
  };

  return (
    <>
      <div className={`peer-quick-send${disabled ? ' is-disabled' : ''}`}>
        <textarea
          className="peer-quick-input"
          value={text}
          disabled={disabled}
          rows={1}
          placeholder={t.placeholder}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError('');
          }}
        />
        {text.trim() ? (
          <button type="button" className="peer-quick-send-btn" disabled={disabled} onClick={sendText}>
            {t.send}
          </button>
        ) : null}
        {error ? (
          <p className="peer-quick-error" role="status">
            {error}
          </p>
        ) : null}
      </div>

      {pendingImage ? (
        <div className="preview-overlay" onClick={clearPendingImage}>
          <div className="paste-image-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="paste-image-header">
              <h3 className="paste-image-title">{t.imageTitle}</h3>
              <button type="button" className="icon-button close-button" onClick={clearPendingImage} aria-label={t.cancel}>
                ✕
              </button>
            </div>
            <div className="paste-image-body">
              <img src={pendingImage.url} alt="" className="paste-image-preview" />
            </div>
            <div className="paste-image-actions">
              <button type="button" className="btn-ghost" onClick={clearPendingImage}>
                {t.cancel}
              </button>
              <button type="button" className="btn-save" onClick={sendImage}>
                {t.imageSend}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
