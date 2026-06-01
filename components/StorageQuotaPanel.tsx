'use client';

import {
  formatStorageDevTools,
  hasOpfsSupport,
  shouldShowInflatedBrowserQuotaNote,
  type StorageSnapshot,
  type StorageLocale,
} from '@/lib/opfsStorage';

const hasOPFS = hasOpfsSupport;

type Lang = StorageLocale;

type Copy = {
  storagePanelLabel: string;
  storagePanelMeter: string;
  storageInsecureContext: string;
  storageNoStorageApi: string;
  iosChromeWarn: string;
  safariNoOpfsHint: string;
  storageQuotaInflatedNote: string;
  storageQuotaPcDiskNote: string;
};

type Props = {
  lang: Lang;
  copy: Copy;
  snapshot: StorageSnapshot | null;
  isIos: boolean;
  isMobilePlatform: boolean;
  isChromeOnIos: boolean;
  isStandalone: boolean;
};

export default function StorageQuotaPanel({
  lang,
  copy: t,
  snapshot,
  isIos,
  isMobilePlatform,
  isChromeOnIos,
  isStandalone,
}: Props) {
  if (snapshot?.blockReason === 'insecure-context') {
    return (
      <aside className="storage-aside">
        <p className="storage-aside__warn" role="alert">
          {t.storageInsecureContext}
        </p>
      </aside>
    );
  }

  if (snapshot?.blockReason === 'no-storage-api') {
    return null;
  }

  if (!snapshot || snapshot.quota <= 0) return null;

  const limitBytes = snapshot.quota;
  const usedStr = formatStorageDevTools(snapshot.usage, lang);
  const limitStr = formatStorageDevTools(limitBytes, lang);
  const pct = Math.min(
    100,
    Math.max(0, limitBytes > 0 ? (snapshot.usage / limitBytes) * 100 : 0),
  );
  const meterLabel = t.storagePanelMeter
    .replace('{used}', usedStr)
    .replace('{limit}', limitStr);

  const quotaNote =
    isIos &&
    !isStandalone &&
    shouldShowInflatedBrowserQuotaNote(snapshot, isStandalone)
      ? t.storageQuotaInflatedNote
      : null;

  const pcDiskNote = !isMobilePlatform ? t.storageQuotaPcDiskNote : null;

  return (
    <aside className="storage-aside" aria-label={t.storagePanelLabel}>
      {isChromeOnIos ? <p className="storage-aside__warn">{t.iosChromeWarn}</p> : null}
      {isIos && !hasOPFS() ? <p className="storage-aside__hint">{t.safariNoOpfsHint}</p> : null}

      <p className="storage-aside__title">{t.storagePanelLabel}</p>
      <p className="storage-aside__meter">{meterLabel}</p>
      <span
        className="storage-aside__track"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={meterLabel}
      >
        <span className="storage-aside__fill" style={{ width: `${pct}%` }} />
      </span>
      {pcDiskNote ? <p className="storage-aside__note">{pcDiskNote}</p> : null}
      {quotaNote ? <p className="storage-aside__note">{quotaNote}</p> : null}
    </aside>
  );
}
