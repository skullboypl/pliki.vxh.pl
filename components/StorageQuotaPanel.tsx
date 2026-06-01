'use client';

import {
  formatStorageDevTools,
  hasOpfsSupport,
  shouldShowInflatedBrowserQuotaNote,
  type StorageSnapshot,
  type StorageLocale,
} from '@/lib/opfsStorage';
import {
  effectiveReceiveCapBytes,
  fileLimitMessageVars,
} from '@/lib/fileTransferLimits';

const hasOPFS = hasOpfsSupport;

type Lang = StorageLocale;

type Copy = {
  storagePanelLabel: string;
  storagePanelMeter: string;
  storageInsecureContext: string;
  storageQuotaUnavailable: string;
  iosChromeWarn: string;
  safariNoOpfsHint: string;
  storageQuotaInflatedNote: string;
  storageQuotaPwaNote: string;
  storageQuotaPcDiskNote: string;
  storageQuotaWhileSending: string;
  storageQuotaSharedOrigin: string;
  storageQuotaFree: string;
  storageQuotaOpfs: string;
  storageMaxReceiveOpfs: string;
  storageMaxReceiveRam: string;
  fileLimitsRam: string;
  fileLimitsSend: string;
  fileLimitsNoCloud: string;
  storageModePersisted: string;
  storageModePersistGranted: string;
  storageModeTab: string;
};

type Props = {
  lang: Lang;
  copy: Copy;
  snapshot: StorageSnapshot | null;
  isIos: boolean;
  isMobilePlatform: boolean;
  isChromeOnIos: boolean;
  isStandalone: boolean;
  sendingActive?: boolean;
  showSharedOriginNote?: boolean;
  compact?: boolean;
};

function replaceVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '');
}

function storageModeLabel(
  snapshot: StorageSnapshot,
  isStandalone: boolean,
  t: Copy,
): string {
  if (isStandalone) return t.storageModePersisted;
  if (snapshot.persisted) return t.storageModePersistGranted;
  return t.storageModeTab;
}

function formatMaxReceive(
  snapshot: StorageSnapshot,
  isMobilePlatform: boolean,
  lang: Lang,
): string {
  const cap = effectiveReceiveCapBytes(
    snapshot.available,
    snapshot.quota,
    isMobilePlatform,
  );
  if (!Number.isFinite(cap) || cap >= 2 ** 50) return '—';
  return formatStorageDevTools(cap, lang);
}

export default function StorageQuotaPanel({
  lang,
  copy: t,
  snapshot,
  isIos,
  isMobilePlatform,
  isChromeOnIos,
  isStandalone,
  sendingActive = false,
  showSharedOriginNote = false,
  compact = false,
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

  if (!snapshot) return null;

  const limitBytes = snapshot.quota;
  const hasMeter = limitBytes > 0;
  const usedStr = formatStorageDevTools(snapshot.usage, lang);
  const limitStr = formatStorageDevTools(limitBytes, lang);
  const freeStr = formatStorageDevTools(Math.max(0, snapshot.available), lang);
  const pct = hasMeter
    ? Math.min(100, Math.max(0, (snapshot.usage / limitBytes) * 100))
    : 0;
  const meterLabel = t.storagePanelMeter
    .replace('{used}', usedStr)
    .replace('{limit}', limitStr);

  const opfsOnDisk = Math.max(snapshot.details.fileSystem, snapshot.opfsUsed ?? 0);
  const opfsApi = snapshot.details.fileSystem;

  const limitVars = fileLimitMessageVars();
  const maxReceive = formatMaxReceive(snapshot, isMobilePlatform, lang);
  const maxReceiveLine = hasOPFS()
    ? replaceVars(t.storageMaxReceiveOpfs, { max: maxReceive })
    : replaceVars(t.storageMaxReceiveRam, { ...limitVars, max: maxReceive });

  const quotaNote =
    !isStandalone &&
    isIos &&
    shouldShowInflatedBrowserQuotaNote(snapshot, isStandalone)
      ? t.storageQuotaInflatedNote
      : null;

  const pwaNote = isStandalone ? t.storageQuotaPwaNote : null;
  const pcDiskNote = !isMobilePlatform ? t.storageQuotaPcDiskNote : null;
  const highUsage = hasMeter && pct >= 85;

  return (
    <aside
      className={`storage-aside${compact ? ' storage-aside--compact' : ''}`}
      aria-label={t.storagePanelLabel}
    >
      {isChromeOnIos ? <p className="storage-aside__warn">{t.iosChromeWarn}</p> : null}
      {isIos && !hasOPFS() ? <p className="storage-aside__hint">{t.safariNoOpfsHint}</p> : null}
      {highUsage ? (
        <p className="storage-aside__warn" role="alert">
          {lang === 'pl'
            ? 'Mało wolnego miejsca — duży odbiór może się nie udać. Usuń stare pliki z „Odebrane”.'
            : 'Low free space — large receives may fail. Delete old items under Received files.'}
        </p>
      ) : null}

      <p className="storage-aside__title">{t.storagePanelLabel}</p>

      {hasMeter ? (
        <>
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
        </>
      ) : (
        <p className="storage-aside__warn" role="status">
          {t.storageQuotaUnavailable}
        </p>
      )}

      <p className="storage-aside__detail">
        {replaceVars(t.storageQuotaFree, {
          free: freeStr,
          mode: storageModeLabel(snapshot, isStandalone, t),
        })}
      </p>

      <p className="storage-aside__detail">{maxReceiveLine}</p>

      <p className="storage-aside__detail storage-aside__detail--sub">
        {replaceVars(t.storageQuotaOpfs, {
          opfs: formatStorageDevTools(opfsOnDisk, lang),
          apiOpfs: formatStorageDevTools(opfsApi, lang),
        })}
      </p>

      {!compact ? (
        <ul className="storage-aside__limits">
          <li>{t.fileLimitsNoCloud}</li>
          <li>{t.fileLimitsSend}</li>
          <li>{replaceVars(t.fileLimitsRam, limitVars)}</li>
        </ul>
      ) : null}

      {showSharedOriginNote ? (
        <p className="storage-aside__note">{t.storageQuotaSharedOrigin}</p>
      ) : null}
      {sendingActive ? (
        <p className="storage-aside__note">{t.storageQuotaWhileSending}</p>
      ) : null}
      {pwaNote ? <p className="storage-aside__note">{pwaNote}</p> : null}
      {pcDiskNote ? <p className="storage-aside__note">{pcDiskNote}</p> : null}
      {quotaNote ? <p className="storage-aside__note">{quotaNote}</p> : null}
    </aside>
  );
}
