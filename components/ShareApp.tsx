'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { type Socket } from 'socket.io-client';
import { acquireSignalingSocket, releaseSignalingSocket } from '@/lib/signalingSocket';
import { displayNickname, isGeneratedNick } from '@/lib/nicknames';
import {
  detectDeviceKind,
  isStandalonePwa,
  normalizeDeviceKind,
  watchPwaDisplayMode,
  type DeviceKind,
} from '@/lib/device';
import {
  buildOpfsEntryName,
  timestampFromOpfsEntry,
  type ClientSurface,
} from '@/lib/clientSurface';
import { formatDualSurfaceWarning, watchOtherClientSurface } from '@/lib/clientPresence';
import { IconFile, IconShareIos, IconSpinner, IconUpload, IconWifi } from '@/components/icons';
import FileDropOverlay from '@/components/FileDropOverlay';
import PeerQuickSend from '@/components/PeerQuickSend';
import TextFilePreview from '@/components/TextFilePreview';
import { useFileDrop } from '@/hooks/useFileDrop';

const PreviewVideoPlayer = dynamic(() => import('@/components/PreviewVideoPlayer'), {
  ssr: false,
  loading: () => <p className="preview-text-status">…</p>,
});
const PreviewAudioPlayer = dynamic(() => import('@/components/PreviewAudioPlayer'), {
  ssr: false,
  loading: () => <p className="preview-text-status">…</p>,
});
import { isAudioLink } from '@/lib/audioMedia';
import {
  RECEIVE_RAM_LIMIT_DESKTOP,
  RECEIVE_RAM_LIMIT_MOBILE,
} from '@/lib/fileTransferLimits';
import {
  bytesRequiredForReceive,
  formatStorageBrief,
  formatStorageDevTools,
  freeStorageForIncoming,
  getStorageBudget,
  getStorageSnapshot,
  displayNameFromOpfsEntry,
  listOpfsStoredEntries,
  hasOpfsSupport,
  isQuotaExceededError,
  purgeOpfsStaging,
  removeOpfsEntry,
  requestPersistentStorageIfPwa,
  type StorageSnapshot,
} from '@/lib/opfsStorage';
import { EMPTY_CACHE_INSPECT } from '@/lib/cacheQuotaInspect';
import {
  getReceivedFileManifest,
  saveReceivedFileManifest,
  removeReceivedFileManifest,
  pruneReceivedFileManifest,
  clearReceivedFileManifest,
} from '@/lib/receivedFileManifest';
import {
  clearBrowserSessionMarker,
  clearPageReloadingFlag,
  isNewBrowserSession,
  isPageReloading,
  markBrowserSession,
  markPageReloading,
} from '@/lib/receivedStorageSession';
import { textToNoteFile } from '@/lib/textNote';
import ShareStrip from '@/components/ShareStrip';
import ReceivedFilesList, { type ReceivedFile } from '@/components/ReceivedFilesList';
import SiteFooter, { SiteFooterAppMeta } from '@/components/SiteFooter';
import StorageQuotaPanel from '@/components/StorageQuotaPanel';
import ConfirmModal from '@/components/ConfirmModal';
import ZipContentsModal from '@/components/ZipContentsModal';
import { APP_DISPLAY_VERSION } from '@/lib/appRelease';
import { isZipArchiveName, listZipEntries, type ZipEntryInfo } from '@/lib/zipEntryList';
import { PeerAnimalIcon, PeerDeviceIcon } from '@/components/peer-icons';
import {
  TRANSFER_CONFIG,
  ackTimeoutForFileSize,
  applyFileChannelTuning,
  pickTransferTuning,
  quietMaxWaitForRemaining,
  quietMsForFileSize,
  sendBinaryWithRetry,
  sendBlobChunks,
  sleep,
  type TransferTuning,
  waitAllFlushed,
  waitForRecvReady,
  waitForSendComplete,
} from '@/lib/webrtcTransfer';

const ICE_SERVERS: RTCIceServer[] = [];

const isIOS = () => /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
const isAndroid = () => /android/.test(navigator.userAgent.toLowerCase());
const isChromeIOS = () => /CriOS/.test(navigator.userAgent);
const detectDeviceHints = () => {
  if (typeof window === 'undefined') return { ios: false, android: false };
  const ua = window.navigator.userAgent.toLowerCase();
  const win = window as Window & { MSStream?: unknown };
  return {
    ios: /iphone|ipad|ipod/.test(ua) && !win.MSStream,
    android: /android/.test(ua),
  };
};

const isMobile = () =>
  isIOS() ||
  isAndroid() ||
  (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches);
const hasOPFS = hasOpfsSupport;
const version = APP_DISPLAY_VERSION;
const SERVER_OFFLINE_GRACE_MS = 4500;
const SERVER_OFFLINE_RECONNECT_MS = 2000;

const formatSize = (bytes: number) => {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};


type Lang = 'pl' | 'en';
type Peer = {
  id: string;
  name: string;
  shortId?: string;
  device?: DeviceKind;
  standalone?: boolean;
};
type PeerAgent = 'web' | 'mobile';

interface FileMetadata {
  name?: string;
  type?: string;
  mime?: string;
  size?: number;
  origin?: string;
  batchId?: string;
  batchIndex?: number;
  batchTotal?: number;
}

interface TransferProgressEntry {
  sent?: number;
  received?: number;
  total?: number;
  mode?: 'send' | 'recv';
  netOutD?: number;
  netInD?: number;
  batchIndex?: number;
  batchTotal?: number;
  fileName?: string;
}

interface SendBatch {
  files: File[];
  index: number;
  inputId?: string;
  batchId: string;
}

interface OpfsInboundBuf {
  parts: Uint8Array[];
  byteLen: number;
}

const concatUint8Parts = (parts: Uint8Array[], byteLen: number): Uint8Array => {
  const out = new Uint8Array(byteLen);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.byteLength;
  }
  return out;
};

/** Keep the picker File handle — no arrayBuffer clone (large files would fill origin storage/RAM). */
const pickSelectedFiles = (fileList: FileList | null): File[] =>
  Array.from(fileList ?? []).filter((f) => f.name && f.size > 0);

const clearFileInputForPeer = (peerId: string, input?: HTMLInputElement | null) => {
  const el = input ?? (document.getElementById(`file-input-${peerId}`) as HTMLInputElement | null);
  if (el) el.value = '';
};

interface DownloadLink extends ReceivedFile {}

interface TransferInfoEntry {
  text: string;
  tone?: 'info' | 'warn';
}

type QuotaReceiveModal = {
  peerId: string;
  neededBytes: number;
  availableBytes: number;
  fileName: string;
};

type IncomingFileMeta = {
  name?: string;
  size?: number;
  type?: string;
  mime?: string;
};

type OpfsReceiveStart = 'ok' | 'quota-prompt' | 'ram-fallback' | 'error';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface HelloMessage {
  type: 'hello';
  agent?: PeerAgent;
  version?: string;
}

interface FileMetadataMessage {
  type: 'file_metadata';
  metadata?: FileMetadata;
}

interface FileEndMessage {
  type: 'file_end';
}

interface FileEndAckMessage {
  type: 'file_end_ack';
}

interface FileCancelMessage {
  type: 'file_cancel';
}

interface FileIncompleteMessage {
  type: 'file_incomplete';
  got?: number;
  expected?: number;
}

interface FileRecvReadyMessage {
  type: 'file_recv_ready';
}

interface FileRecvDeniedMessage {
  type: 'file_recv_denied';
  reason?: string;
  needed?: number;
  available?: number;
}

interface FlowPauseMessage {
  type: 'flow_pause';
}

interface FlowResumeMessage {
  type: 'flow_resume';
}

type CtrlMessage =
  | HelloMessage
  | FileMetadataMessage
  | FileEndMessage
  | FileEndAckMessage
  | FileCancelMessage
  | FileIncompleteMessage
  | FileRecvReadyMessage
  | FileRecvDeniedMessage
  | FlowPauseMessage
  | FlowResumeMessage
  | Record<string, unknown>;

interface SignalOffer {
  type: 'offer';
  sdp: string;
}

interface SignalAnswer {
  type: 'answer';
  sdp: string;
}

interface SignalCandidate {
  type: 'candidate';
  candidate: RTCIceCandidateInit;
}

type SignalPayload = SignalOffer | SignalAnswer | SignalCandidate;

interface OpfsWriterResult {
  handle: FileSystemFileHandle;
  writer: FileSystemWritableFileStream;
  name: string;
}

/* ========= i18n ========= */
const MESSAGES = {
  pl: {
    appTitle: 'Wyślij plik',
    appSubtitle: 'Oba telefony / komputery muszą być w tej samej sieci WiFi',
    howTitle: 'Jak to działa?',
    step1: 'Otwórz tę stronę na dwóch urządzeniach (ta sama WiFi).',
    step2: 'Wybierz urządzenie z listy poniżej.',
    step3: 'Kliknij zielony przycisk, przeciągnij pliki na urządzenie z listy lub upuść je na stronie.',
    stepReceive: 'Na drugim urządzeniu plik pojawi się w sekcji „Odebrane pliki”.',
    fileLimitsTitle: 'Rozmiar plików',
    fileLimitsNoCloud:
      'Bez limitu po stronie serwera: pliki lecą bezpośrednio między urządzeniami w tej samej WiFi.',
    storagePanelLabel: 'Limit w przeglądarce',
    storagePanelMeter: '{used} / ok. {limit}',
    unknownSender: 'Nieznany nadawca',
    previewClosedForTransfer: 'Podgląd wideo zamknięty na czas transferu pliku.',
    previewVideoError:
      'Nie można odtworzyć pliku (uszkodzony, niepełny transfer lub format nieobsługiwany). Zapisz na dysk i otwórz w odtwarzaczu.',
    storageInsecureContext:
      'Duże pliki mogą nie działać na tym adresie. Użyj połączenia z kłódką (HTTPS).',
    storageQuotaUnavailable:
      'Nie udało się odczytać limitu z przeglądarki. Odbiór i tak zapisuje pliki na dysk (OPFS), aż zabraknie miejsca — wtedy zobaczysz błąd przy urządzeniu.',
    storageQuotaPwaNote:
      'W PWA limit zwykle pokazuje realne wolne miejsce na telefonie (po zezwoleniu na pamięć trwałą).',
    storageQuotaBytesLine:
      'navigator.storage.estimate(): {usageBytes} / {quotaBytes} bajtów',
    storageQuotaRawLine: 'estimate() surowe quota: {quotaBytes} B',
    storageQuotaDevToolsHint:
      'Pasek = Chrome DevTools → Application → Storage (webkit / estimate). Odbiór plików liczy wyższe usage, gdy OPFS na dysku > API.',
    storageQuotaFree: 'Wolne: {free} · {mode}',
    storageQuotaFreeShort: 'Wolne: {free}',
    storageReceivedInApp: 'Zajęte przez odebrane pliki: ~{size}',
    storageMaxReceiveShort: 'Maks. jeden plik teraz: ~{max}',
    storageMoreDetails: 'Więcej informacji',
    storageDevDiagnostics: 'Diagnostyka (środowisko dev)',
    storageQuotaOpfs: 'OPFS na dysku: {opfs} (z API: {apiOpfs})',
    storageMaxReceiveOpfs: 'Maks. jeden plik teraz (wolne − 48 MB): ~{max}',
    storageMaxReceiveRam:
      'Bez zapisu na dysk (OPFS niedostępny): maks. ~{max} w RAM (telefon {ramMobileMb} MB / PC {ramDesktopMb} MB).',
    fileLimitsRam:
      'Gdy przeglądarka nie zapisuje na dysk (np. Chrome na iPhone): powyżej ~{ramMobileMb} MB na telefonie lub ~{ramDesktopMb} MB na komputerze odbiór może się nie udać.',
    fileLimitsSend:
      'Wysyłka strumieniuje plik z dysku — nie zapisuje go w OPFS jak odbiór. Pasek limitu pokazuje całą stronę (np. wcześniejsze odbiory).',
    storageQuotaWhileSending:
      'Trwa wysyłka: plik nie trafia do OPFS. Rośnie tylko tymczasowy bufor Chrome — po zakończeniu usage zwykle spada.',
    storageQuotaSharedOrigin:
      'PWA i zwykła karta Chrome dzielą limit dysku tej strony (to nie są dwa dyski). Lista „Odebrane” jest osobna w każdym oknie.',
    storageModePersisted: 'PWA (zainstalowana aplikacja)',
    storageModePersistGranted: 'pamięć trwała',
    storageModePersistSafari: 'pamięć trwała (Safari)',
    storageModeTab: 'karta przeglądarki',
    iosChromeWarn: 'Na iPhone użyj Safari (nie Chrome).',
    safariNoOpfsHint:
      'Duże pliki: w Safari dodaj stronę do ekranu początkowego (PWA), albo wyślij mniejsze partie.',
    fileLimitsOpaqueCache:
      'W Chrome wpisy „nieprzejrzyste” w Cache Storage (CDN bez CORS) liczą się do limitu jak ~7 MB każdy; w DevTools → Application widać mniejszy rozmiar, a navigator.storage pokazuje większe zajęcie.',
    transferQuotaPrompt:
      'Mało miejsca w przeglądarce (potrzeba ~{needed}, wolne {free}). Odebrać mimo to?',
    transferQuotaModalTitle: 'Mało miejsca w przeglądarce',
    transferQuotaTryAnyway: 'Spróbuj mimo to',
    transferQuotaDeleteOld: 'Usuń stare',
    transferQuotaDeleteAll: 'Usuń wszystkie',
    transferQuotaBack: 'Wróć',
    transferQuotaPurgeHint: 'Usuń odebrane pliki, żeby zwolnić miejsce:',
    transferQuotaPurgeEmpty: 'Brak zapisanych plików do usunięcia.',
    transferQuotaCancel: 'Odrzuć odbiór',
    transferQuotaError:
      'Brak miejsca w przeglądarce. Usuń pliki z „Odebrane” lub wyczyść dane witryny w ustawieniach przeglądarki.',
    transferRecvDenied:
      'Odbiorca nie ma miejsca w przeglądarce ({available} wolne, potrzeba ~{needed}).',
    storageBudgetOpfs:
      'OPFS (Origin Private File System w DevTools): {opfs}. Tu trafiają odebrane pliki.',
    storageBudgetOther:
      'Pozostałe: IndexedDB {idb}, Cache Storage {cache} (jak DevTools → Cache Storage).',
    storageBudgetCacheScan:
      'Skan Cache: {entries} wpisów ({stores} magazynów), {opaque} nieprzejrzystych. Chrome dolicza ~{padding} do limitu mimo mniejszego rozmiaru w DevTools.',
    storageBudgetOpaqueHint:
      'Limit QuotaExceeded liczy navigator.storage (z paddingiem nieprzejrzystych), nie sumę rozmiarów plików OPFS.',
    storageClearCacheBtn: 'Wyczyść Cache Storage',
    storageCacheCleared: 'Wyczyszczono pamięć podręczną ({count} magazynów).',
    storagePurgedList:
      'Zwolniono miejsce: usunięto {count} poprzednich plików ze schowka przeglądarki.',
    youAre: 'Jesteś w sieci jako',
    changeName: 'Zmień imię',
    namePlaceholder: 'np. Tomek',
    nameHint: 'Bez wpisywania dostaniesz losowy nick.',
    devicesTitle: 'Urządzenia w sieci',
    sendFileBtn: 'Wybierz pliki i wyślij',
    sendFileTo: 'Wyślij pliki do: {name}',
    sendToDevice: 'Urządzenie w sieci',
    dropOverlayTitle: 'Przeciągasz plik',
    dropOverlayHint: 'Upuść plik w oknie aplikacji',
    dropOverlayHintOne: 'Puść gdziekolwiek. Wyśle do: {name}',
    dropOverlayHintMany: 'Kilka urządzeń. Upuść plik na wybraną kartę poniżej.',
    dropOverlayOnDevice: 'Puść na: {name}',
    dropOverlayNoDevices: 'Brak dostępnych urządzeń. Poczekaj na połączenie.',
    dropOverlayNeedName: 'Ustaw imię powyżej, potem upuść pliki.',
    dropNeedConnection: 'Brak połączenia z serwisem. Odśwież stronę.',
    dropPeerBusy: 'To urządzenie właśnie wysyła lub odbiera plik',
    dropNoDevices: 'Brak urządzeń gotowych do wysyłki',
    dropPickDevice: 'Upuść plik na kartę urządzenia (nie na przyciemnione tło)',
    deviceDesktop: 'Komputer',
    deviceDesktopPwa: 'Komputer · PWA',
    deviceIphone: 'iPhone',
    deviceIphonePwa: 'iPhone · PWA',
    deviceIpad: 'iPad',
    deviceIpadPwa: 'iPad · PWA',
    deviceAndroid: 'Android',
    deviceAndroidPwa: 'Android · PWA',
    deviceMobile: 'Telefon',
    deviceMobilePwa: 'Telefon · PWA',
    connecting: 'Łączenie…',
    waitingDevices: 'Czekam na drugie urządzenie…',
    waitingHint: 'Wejdź na tę samą stronę na telefonie lub komputerze w tej samej WiFi.',
    receivedFiles: 'Odebrane pliki',
    receivedHint:
      'Tu zobaczysz odebrane pliki. Znikną po zamknięciu karty/aplikacji PWA.',
    receivedDeleteAll: 'Usuń wszystkie odebrane',
    receivedDeleteAllConfirm:
      'Usunąć wszystkie pliki z listy i z pamięci przeglądarki?',
    receivedDeleteAllYes: 'Usuń',
    modalCancel: 'Anuluj',
    saveFile: 'Zapisz plik',
    fromWho: 'Od: {name}',
    showDetails: 'Pokaż logi techniczne',
    hideLogs: 'Ukryj logi',
    noLogs: '…',
    online: 'Połączono',
    offline: 'Łączenie…',
    serverOffline: 'Brak połączenia',
    serverOfflineTitle: 'Nie możemy połączyć się z serwisem',
    serverOfflineBody:
      'Bez tego połączenia nie zobaczysz innych urządzeń w sieci. Sprawdź internet lub WiFi, a potem odśwież stronę.',
    serverOfflineRetry: 'Odśwież stronę',
    understood: 'OK',
    iosInstallBody: 'Dla lepszego działania: Safari → Udostępnij → Dodaj do ekranu początkowego.',
    installBtn: 'Zainstaluj',
    installAppBtn: 'Zainstaluj aplikację pliki.vxh.pl',
    installAppBtnHint: 'Skrót na pulpicie. Stabilniejsze duże pliki i zapis odebranych.',
    installDesktopHeading: 'Aplikacja na komputerze',
    recommendationsTitle: 'Zalecenia',
    pwaIosHint: 'Safari → Udostępnij → Dodaj do ekranu początkowego',
    pwaMobileTitle: 'Aplikacja na ekranie początkowym (PWA)',
    pwaMobileBodyIos:
      'W zwykłej karcie Safari przeglądarka może usunąć odebrane pliki i gorzej radzi sobie z dużymi transferami. Dodanie do ekranu początkowego działa stabilniej.',
    pwaMobileBodyAndroid:
      'W zwykłej karcie Chrome na Androidzie duże pliki bywają mniej stabilne. Zainstaluj aplikację na ekranie głównym.',
    pwaMobileStepShare: 'Dotknij ikony Udostępnij na dole Safari',
    pwaMobileStepAdd: 'Wybierz „Dodaj do ekranu początkowego”',
    pwaMobileStepOpen: 'Otwieraj pliki z ikony na pulpicie, nie z karty Safari',
    pwaAndroidStepMenu: 'Menu Chrome (⋮) w prawym górnym rogu',
    pwaAndroidStepInstall: 'Wybierz „Zainstaluj aplikację” lub „Dodaj do ekranu głównego”',
    pwaAndroidStepOpen: 'Otwieraj z ikony na ekranie głównym, nie z karty przeglądarki',
    storageQuotaInflatedNote: 'Limit bywa zawyżony. Duże pliki: PWA w Zaleceniach.',
    storageQuotaPcDiskNote:
      'Pokazywany limit jest niedokładny. Przeglądarka ukrywa stan dysku, choć realnie możesz mieć nawet 1 TB.',
    transferSending: 'Wysyłanie pliku…',
    transferSendingBatch: 'Wysyłanie plików ({index}/{total})…',
    batchSent: 'Wysłano {count} plików',
    transferReceiving: 'Odbieranie pliku…',
    cancelTransfer: 'Anuluj wysyłanie',
    transferCancelled: 'Wysyłanie anulowane',
    transferCancelledRemote: 'Nadawca anulował transfer',
    transferRetrying: 'Uzupełnianie brakujących danych… ({pct}%)',
    transferIncomplete: 'Transfer niekompletny. Spróbuj ponownie.',
    transferConfirming: 'Wysłano, czekam na zapis u odbiorcy…',
    fileReadError: 'Nie można odczytać pliku: {msg}',
    showBTN: 'Podgląd',
    zipListBtn: 'Zawartość',
    previewBundlePrev: 'Poprzedni',
    previewBundleNext: 'Następny',
    newFile: 'Nowy plik!',
  },
  en: {
    appTitle: 'Send a file',
    appSubtitle: 'Both devices must be on the same WiFi network',
    howTitle: 'How it works',
    step1: 'Open this page on two devices (same WiFi).',
    step2: 'Pick a device from the list below.',
    step3: 'Tap the green button, drag files onto a device in the list, or drop them on the page.',
    stepReceive: 'On the other device the file appears under “Received files”.',
    fileLimitsTitle: 'File sizes',
    fileLimitsNoCloud:
      'No server-side cap: files go directly between devices on the same WiFi.',
    storagePanelLabel: 'Browser limit',
    storagePanelMeter: '{used} / about {limit}',
    unknownSender: 'Unknown sender',
    previewClosedForTransfer: 'Video preview closed while a file transfer is active.',
    previewVideoError:
      'Cannot play this file (corrupt, incomplete transfer, or unsupported format). Save to disk and open in a player.',
    storageInsecureContext: 'Large files may not work here. Use HTTPS (lock icon).',
    storageQuotaUnavailable:
      'Could not read a storage limit from the browser. Receives still use disk (OPFS) until full — then you will see an error on the device row.',
    storageQuotaPwaNote:
      'In the installed PWA, the bar usually reflects real free space on your phone (after persistent storage is granted).',
    storageQuotaBytesLine: 'navigator.storage.estimate(): {usageBytes} / {quotaBytes} bytes',
    storageQuotaRawLine: 'raw estimate() quota: {quotaBytes} B',
    storageQuotaDevToolsHint:
      'Bar matches Chrome DevTools → Application → Storage (webkit / estimate). Large receives use higher effective usage when OPFS on disk exceeds API.',
    storageQuotaFree: 'Free: {free} · {mode}',
    storageQuotaFreeShort: 'Free: {free}',
    storageReceivedInApp: 'Used by received files: ~{size}',
    storageMaxReceiveShort: 'Max single file now: ~{max}',
    storageMoreDetails: 'More info',
    storageDevDiagnostics: 'Diagnostics (dev environment)',
    storageQuotaOpfs: 'OPFS on disk: {opfs} (API: {apiOpfs})',
    storageMaxReceiveOpfs: 'Max single file now (free − 48 MB): ~{max}',
    storageMaxReceiveRam:
      'No disk staging (OPFS unavailable): max ~{max} in RAM (phone {ramMobileMb} MB / desktop {ramDesktopMb} MB).',
    fileLimitsRam:
      'If the browser cannot save to disk (e.g. Chrome on iPhone): receiving above ~{ramMobileMb} MB on a phone or ~{ramDesktopMb} MB on a computer may fail.',
    fileLimitsSend:
      'Sending streams from disk — unlike receive, it is not saved to OPFS. The meter is for the whole origin (e.g. past downloads).',
    storageQuotaWhileSending:
      'Sending: the file is not written to OPFS. Chrome may show a temporary spike that usually drops after the transfer.',
    storageQuotaSharedOrigin:
      'PWA and a normal Chrome tab share this site’s storage quota (not two separate disks). Each window has its own received-files list.',
    storageModePersisted: 'PWA (installed app)',
    storageModePersistGranted: 'persistent storage',
    storageModePersistSafari: 'persistent storage (Safari)',
    storageModeTab: 'browser tab',
    iosChromeWarn: 'On iPhone use Safari (not Chrome).',
    safariNoOpfsHint:
      'Large files: add this site to Home Screen in Safari (PWA), or send smaller parts.',
    fileLimitsOpaqueCache:
      'In Chrome, opaque Cache Storage entries (cross-origin without CORS) count toward quota as ~7 MB each; DevTools shows a smaller size than navigator.storage usage.',
    transferQuotaPrompt:
      'Low browser storage (needs ~{needed}, {free} free). Try receiving anyway?',
    transferQuotaModalTitle: 'Low browser storage',
    transferQuotaTryAnyway: 'Try anyway',
    transferQuotaDeleteOld: 'Delete old files',
    transferQuotaDeleteAll: 'Delete all',
    transferQuotaBack: 'Back',
    transferQuotaPurgeHint: 'Remove received files to free space:',
    transferQuotaPurgeEmpty: 'No saved files to remove.',
    transferQuotaCancel: 'Decline receive',
    transferQuotaError:
      'Not enough browser storage. Remove files from “Received” or clear site data in browser settings.',
    transferRecvDenied:
      'Receiver has no browser storage left ({available} free, need ~{needed}).',
    storageBudgetOpfs:
      'OPFS (Origin Private File System in DevTools): {opfs}. Received files land here.',
    storageBudgetOther:
      'Other: IndexedDB {idb}, Cache Storage {cache} (DevTools → Cache Storage).',
    storageBudgetCacheScan:
      'Cache scan: {entries} entries ({stores} stores), {opaque} opaque. Chrome adds ~{padding} to quota vs smaller DevTools size.',
    storageBudgetOpaqueHint:
      'QuotaExceeded uses navigator.storage (incl. opaque padding), not the sum of OPFS file sizes.',
    storageClearCacheBtn: 'Clear Cache Storage',
    storageCacheCleared: 'Cleared cache ({count} store(s)).',
    storagePurgedList:
      'Freed space: removed {count} previous file(s) from browser staging.',
    youAre: 'You are on the network as',
    changeName: 'Change name',
    namePlaceholder: 'e.g. Tom',
    nameHint: 'Leave empty for a random nickname.',
    devicesTitle: 'Devices on the network',
    sendFileBtn: 'Choose files and send',
    sendFileTo: 'Send files to: {name}',
    sendToDevice: 'Device on network',
    dropOverlayTitle: 'Dragging a file',
    dropOverlayHint: 'Drop the file in the app window',
    dropOverlayHintOne: 'Drop anywhere. Sends to: {name}',
    dropOverlayHintMany: 'Several devices. Drop the file on a card below.',
    dropOverlayOnDevice: 'Drop on: {name}',
    dropOverlayNoDevices: 'No available devices. Wait for a connection.',
    dropOverlayNeedName: 'Set your name above, then drop files.',
    dropNeedConnection: 'Not connected to the service. Refresh the page.',
    dropPeerBusy: 'That device is busy sending or receiving',
    dropNoDevices: 'No devices ready to receive',
    dropPickDevice: 'Drop the file on a device card (not on the dimmed area)',
    deviceDesktop: 'Computer',
    deviceDesktopPwa: 'Computer · PWA',
    deviceIphone: 'iPhone',
    deviceIphonePwa: 'iPhone · PWA',
    deviceIpad: 'iPad',
    deviceIpadPwa: 'iPad · PWA',
    deviceAndroid: 'Android',
    deviceAndroidPwa: 'Android · PWA',
    deviceMobile: 'Phone',
    deviceMobilePwa: 'Phone · PWA',
    connecting: 'Connecting…',
    waitingDevices: 'Waiting for another device…',
    waitingHint: 'Open this page on a phone or PC on the same WiFi.',
    receivedFiles: 'Received files',
    receivedHint:
      'Received files appear here. They disappear when you close the tab or PWA app.',
    receivedDeleteAll: 'Delete all received',
    receivedDeleteAllConfirm:
      'Remove all files from the list and from browser storage?',
    receivedDeleteAllYes: 'Delete',
    modalCancel: 'Cancel',
    saveFile: 'Save file',
    fromWho: 'From: {name}',
    showDetails: 'Show technical logs',
    hideLogs: 'Hide logs',
    noLogs: '…',
    online: 'Connected',
    offline: 'Connecting…',
    serverOffline: 'No connection',
    serverOfflineTitle: "Can't connect to the service",
    serverOfflineBody:
      "Without this connection you won't see other devices on the network. Check your internet or WiFi, then refresh the page.",
    serverOfflineRetry: 'Refresh page',
    understood: 'OK',
    iosInstallBody: 'For best results: Safari → Share → Add to Home Screen.',
    installBtn: 'Install',
    installAppBtn: 'Install pliki.vxh.pl app',
    installAppBtnHint: 'Desktop shortcut. More reliable large files and storage.',
    installDesktopHeading: 'Desktop app',
    recommendationsTitle: 'Recommendations',
    pwaIosHint: 'Safari → Share → Add to Home Screen',
    pwaMobileTitle: 'Add to Home Screen (PWA)',
    pwaMobileBodyIos:
      'In a normal Safari tab the browser may delete received files and large transfers are less reliable. Adding to Home Screen works better.',
    pwaMobileBodyAndroid:
      'In a normal Chrome tab on Android, large files can be less reliable. Install the app on your Home Screen.',
    pwaMobileStepShare: 'Tap Share at the bottom of Safari',
    pwaMobileStepAdd: 'Choose “Add to Home Screen”',
    pwaMobileStepOpen: 'Open the app from your Home Screen icon, not the Safari tab',
    pwaAndroidStepMenu: 'Chrome menu (⋮) in the top-right corner',
    pwaAndroidStepInstall: 'Choose “Install app” or “Add to Home screen”',
    pwaAndroidStepOpen: 'Open from your Home Screen icon, not the browser tab',
    storageQuotaInflatedNote: 'Limit may be inflated. Large files: use PWA in Recommendations.',
    storageQuotaPcDiskNote:
      'The shown limit is inaccurate. The browser hides disk space; you may actually have 1 TB or more free.',
    transferSending: 'Sending file…',
    transferSendingBatch: 'Sending files ({index}/{total})…',
    batchSent: 'Sent {count} files',
    transferReceiving: 'Receiving file…',
    cancelTransfer: 'Cancel upload',
    transferCancelled: 'Upload cancelled',
    transferCancelledRemote: 'Sender cancelled the transfer',
    transferRetrying: 'Recovering missing data… ({pct}%)',
    transferIncomplete: 'Transfer incomplete. Please try again.',
    transferConfirming: 'Sent, waiting for receiver to finish saving…',
    fileReadError: 'Could not read file: {msg}',
    showBTN: 'Preview',
    zipListBtn: 'Contents',
    previewBundlePrev: 'Previous',
    previewBundleNext: 'Next',
    newFile: 'New file!',
  },
} as const;

type MessageKey = keyof (typeof MESSAGES)['pl'];

/* ========= i18n LOGS ========= */
const LOGS = {
  pl: {
    connectedWithId: (code: string) => `Połączono! Twój kod: ${code}`,
    iceState: (who: string, st: string) => `🛰 Stan ICE z ${who}: ${st}`,
    ctrlOpen: (who: string) => `🟢 CTRL z ${who} otwarty`,
    ctrlClosed: (who: string) => `🔴 CTRL z ${who} zamknięty`,
    fileOpen: (who: string) => `🔗 FILE z ${who} otwarty`,
    fileClosed: (who: string) => `🔴 FILE z ${who} zamknięty`,
    fileChunk: (who: string, kb: string) => `📏 FILE chunk dla ${who}: ${kb} KB`,
    signalError: (who: string, msg: string) => `⚠️ Błąd sygnału z ${who}: ${msg}`,
    ctrlError: (who: string, details: string) => `❗ CTRL błąd z ${who}: ${details}`,
    fileError: (who: string, details: string) => `❗ FILE błąd z ${who}: ${details}`,
    ctrlMsg: (who: string, data: string) => `💬 [CTRL] ${who}: ${data}`,
    opfsStart: (name: string) => `💾 OPFS: zapis strumieniowy rozpoczęty (${name})`,
    opfsFallback: (why: string) => `⚠️ OPFS niedostępne → bufor RAM (ryzyko pamięci): ${why}`,
    opfsChromeIOSNote: () =>
      'ℹ️ Na iOS w Chrome OPFS nie działa. Otwórz w Safari lub zainstaluj jako PWA z Safari.',
    bigRamWarning: (mb: string) =>
      `⛔ Ten plik ma ${mb} MB. Bez OPFS może zabraknąć pamięci. Polecam Safari (OPFS).`,
    quotaExceeded: (detail: string) => `QuotaExceeded: ${detail}`,
    opfsPurged: (n: string) => `🧹 OPFS: usunięto ${n} starych plików ze stagingu`,
    storageBudget: (detail: string) => `💾 Miejsce w przeglądarce: ${detail}`,
    recvDenied: (detail: string) => `Odbiór odrzucony: ${detail}`,
    sendDone: (who: string) => `✅ Wysłano plik do ${who}`,
    fileReceived: (name: string) => `📥 Pobrano plik: ${name}`,
    fileSent: (name: string) => `📤 Wysłano Plik "${name}"`,
    sendError: (who: string, msg: string) => `❗ Błąd wysyłki do ${who}: ${msg}`,
    sendResume: (offset: string, total: string, n: number) =>
      `🔄 Wznowienie wysyłki (${n}): od ${offset} B / ${total} B`,
    recvIncomplete: (got: string, expected: string, n: number) =>
      `🔄 Brakuje danych (${n}): ${got} / ${expected} B. Proszę nadawcę o uzupełnienie`,
  },
  en: {
    connectedWithId: (code: string) => `Connected! Your code: ${code}`,
    iceState: (who: string, st: string) => `🛰 ICE state with ${who}: ${st}`,
    ctrlOpen: (who: string) => `🟢 CTRL with ${who} opened`,
    ctrlClosed: (who: string) => `🔴 CTRL with ${who} closed`,
    fileOpen: (who: string) => `🔗 FILE with ${who} opened`,
    fileClosed: (who: string) => `🔴 FILE with ${who} closed`,
    fileChunk: (who: string, kb: string) => `📏 FILE chunk for ${who}: ${kb} KB`,
    signalError: (who: string, msg: string) => `⚠️ Signal error from ${who}: ${msg}`,
    ctrlError: (who: string, details: string) => `❗ CTRL error from ${who}: ${details}`,
    fileError: (who: string, details: string) => `❗ FILE error from ${who}: ${details}`,
    ctrlMsg: (who: string, data: string) => `💬 [CTRL] ${who}: ${data}`,
    opfsStart: (name: string) => `💾 OPFS: streaming write started (${name})`,
    opfsFallback: (why: string) => `⚠️ OPFS unavailable → RAM buffer (memory risk): ${why}`,
    opfsChromeIOSNote: () =>
      'ℹ️ On iOS Chrome OPFS does not work. Open in Safari or install as a PWA from Safari.',
    bigRamWarning: (mb: string) =>
      `⛔ This file is ${mb} MB. Without OPFS you may run out of memory. Use Safari (OPFS) if possible.`,
    quotaExceeded: (detail: string) => `QuotaExceeded: ${detail}`,
    opfsPurged: (n: string) => `🧹 OPFS: removed ${n} stale staging file(s)`,
    storageBudget: (detail: string) => `💾 Browser storage: ${detail}`,
    recvDenied: (detail: string) => `Receive denied: ${detail}`,
    sendDone: (who: string) => `✅ File sent to ${who}`,
    fileReceived: (name: string) => `📥 File "${name}" has been received`,
    fileSent: (name: string) => `📤 File "${name}" has been sent`,
    sendError: (who: string, msg: string) => `❗ Send error to ${who}: ${msg}`,
    sendResume: (offset: string, total: string, n: number) =>
      `🔄 Resuming send (${n}): from ${offset} B / ${total} B`,
    recvIncomplete: (got: string, expected: string, n: number) =>
      `🔄 Missing data (${n}): ${got} / ${expected} B. Requesting remainder from sender`,
  },
};

const fmtMB = (bytes: number) => (bytes > 0 ? (bytes / (1024 * 1024)).toFixed(0) : '0');
const whoLabel = (peerNames: Record<string, string>, id: string, lang: Lang) =>
  displayNickname(peerNames[id] || id, lang);

const deviceLabelKey = (device: DeviceKind, standalone?: boolean): MessageKey => {
  if (standalone) {
    switch (device) {
      case 'iphone':
        return 'deviceIphonePwa';
      case 'ipad':
        return 'deviceIpadPwa';
      case 'android':
        return 'deviceAndroidPwa';
      case 'mobile':
        return 'deviceMobilePwa';
      default:
        return 'deviceDesktopPwa';
    }
  }
  switch (device) {
    case 'iphone':
      return 'deviceIphone';
    case 'ipad':
      return 'deviceIpad';
    case 'android':
      return 'deviceAndroid';
    case 'mobile':
      return 'deviceMobile';
    default:
      return 'deviceDesktop';
  }
};

const detectInitialLang = (): Lang => {
  if (typeof window === 'undefined') return 'pl';
  const stored = localStorage.getItem('lang');
  if (stored === 'pl' || stored === 'en') return stored;
  const nav = navigator.language || (navigator as Navigator & { userLanguage?: string }).userLanguage || 'pl';
  return nav.toLowerCase().startsWith('pl') ? 'pl' : 'en';
};

const safeErrMsg = (e: unknown) => {
  try {
    if (e && typeof e === 'object' && 'message' in e) return String((e as Error).message);
    return String(e);
  } catch {
    return 'unknown';
  }
};

const isVideoDownloadLink = (link: { mime?: string; fileName?: string }) => {
  if (isAudioLink(link)) return false;
  const mt = (link.mime || '').toLowerCase();
  if (mt.startsWith('video/')) return true;
  return /\.(mp4|webm|mov|m4v)$/i.test(link.fileName || '');
};

const sortBundleLinks = (a: DownloadLink, b: DownloadLink) =>
  (a.batchIndex ?? 0) - (b.batchIndex ?? 0) || (a.receivedAt ?? 0) - (b.receivedAt ?? 0);

const findBundlePreviewNeighbor = (
  links: DownloadLink[],
  current: DownloadLink,
  dir: -1 | 1,
  isPreviewable: (link: DownloadLink) => boolean,
): DownloadLink | null => {
  const batchId = current.batchId;
  if (!batchId || !current.batchTotal || current.batchTotal <= 1) return null;
  const inBatch = links
    .filter((l) => l.batchId === batchId)
    .filter(isPreviewable)
    .sort(sortBundleLinks);
  const idx = inBatch.findIndex((l) => l.id === current.id);
  if (idx < 0) return null;
  const nextIdx = idx + dir;
  if (nextIdx < 0 || nextIdx >= inBatch.length) return null;
  return inBatch[nextIdx] ?? null;
};

export default function ShareApp() {
  const [lang, setLang] = useState<Lang>(detectInitialLang);
  const [socketId, setSocketId] = useState<string>('');
  const [shortId, setShortId] = useState<string>('');
  const [peers, setPeers] = useState<Peer[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [myName, setMyName] = useState('');
  const [connected, setConnected] = useState(false);
  const [serverUnavailable, setServerUnavailable] = useState(false);
  const [peerNames, setPeerNames] = useState<Record<string, string>>({});
  const [, setIncomingConnectionRequest] = useState<string | null>(null);
  const [transferProgress, setTransferProgress] = useState<Record<string, TransferProgressEntry>>({});
  const [transferInfo, setTransferInfo] = useState<Record<string, TransferInfoEntry>>({});
  const [quotaReceiveModal, setQuotaReceiveModal] = useState<QuotaReceiveModal | null>(null);
  const [quotaModalShowPurge, setQuotaModalShowPurge] = useState(false);
  const [localIps, setLocalIps] = useState<Set<string>>(new Set());
  const [showLogs, setShowLogs] = useState(false);
  const [connectingPeer, setConnectingPeer] = useState<string | null>(null);
  const [downloadLinks, setDownloadLinks] = useState<DownloadLink[]>([]);
  const [previewItem, setPreviewItem] = useState<DownloadLink | null>(null);
  const previewBlobUrlRef = useRef<string | null>(null);
  const [otherClientSurface, setOtherClientSurface] = useState<ClientSurface | null>(null);
  const [deleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false);
  const [zipListModal, setZipListModal] = useState<{
    linkId: number;
    archiveName: string;
    entries: ZipEntryInfo[];
    loading?: boolean;
    error?: string | null;
  } | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deviceHints, setDeviceHints] = useState(detectDeviceHints);
  const [showNameEdit, setShowNameEdit] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const wasConnectedRef = useRef(false);
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  const ctrlChannels = useRef<Record<string, RTCDataChannel>>({});
  const fileChannels = useRef<Record<string, RTCDataChannel>>({});
  const receivedBuffers = useRef<Record<string, ArrayBuffer[] | null>>({});
  const fileMetadata = useRef<Record<string, FileMetadata>>({});
  const logsPanelRef = useRef<HTMLDivElement | null>(null);
  const logsStickToBottom = useRef(true);
  const lastLoggedStorageKey = useRef('');
  const opfsHandles = useRef<Record<string, FileSystemFileHandle>>({});
  const opfsEntryNames = useRef<Record<string, string>>({});
  const downloadLinksRef = useRef<DownloadLink[]>([]);
  const recvQuotaFailed = useRef<Record<string, boolean>>({});
  const recvForceDespiteQuota = useRef<Record<string, boolean>>({});
  const opfsWriters = useRef<Record<string, FileSystemWritableFileStream>>({});
  const opfsOffsets = useRef<Record<string, number>>({});
  const disconnectTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const transferTuning = useRef<Record<string, TransferTuning>>({});
  const netBaseline = useRef<Record<string, { in0?: number | null; out0?: number | null }>>({});
  const sendAbortFlags = useRef<Record<string, boolean>>({});
  const sendReaders = useRef<Record<string, ReadableStreamDefaultReader<Uint8Array>>>({});
  const lastFileActivity = useRef<Record<string, number>>({});
  const receivedBytes = useRef<Record<string, number>>({});
  const writeQueues = useRef<Record<string, Promise<void>>>({});
  const opfsInboundBuf = useRef<Record<string, OpfsInboundBuf>>({});
  const ramInboundBuf = useRef<Record<string, OpfsInboundBuf>>({});
  const opfsInboundWriting = useRef<Record<string, number>>({});
  const recvFlowPauseSent = useRef<Record<string, boolean>>({});
  const sendFlowPaused = useRef<Record<string, boolean>>({});
  const dbgChunks = useRef<Record<string, number>>({});
  const resumeAttempts = useRef<Record<string, number>>({});
  const activeSendFiles = useRef<Record<string, File>>({});
  const sendBatches = useRef<Record<string, SendBatch>>({});
  const pendingFileChunks = useRef<Record<string, Uint8Array[]>>({});
  const peerAgent = useRef<Record<string, PeerAgent>>({});
  const peerNamesRef = useRef(peerNames);
  const langRef = useRef(lang);
  const [pendingSendPeerId, setPendingSendPeerId] = useState<string | null>(null);
  const [storageSnapshot, setStorageSnapshot] = useState<StorageSnapshot | null>(null);
  const downloadsRef = useRef<HTMLDivElement | null>(null);
  peerNamesRef.current = peerNames;
  langRef.current = lang;

  const dn = useCallback((name: string) => displayNickname(name, lang), [lang]);

  const t = (key: MessageKey, vars: Record<string, string> = {}) => {
    const str = MESSAGES[lang][key] ?? MESSAGES.pl[key] ?? key;
    return str.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
  };

  downloadLinksRef.current = downloadLinks;

  const getActiveTransferKeepNames = useCallback((): Set<string> => {
    const keep = new Set<string>();
    for (const name of Object.values(opfsEntryNames.current)) {
      if (name) keep.add(name);
    }
    return keep;
  }, []);

  const getOpfsKeepNames = useCallback((): Set<string> => {
    const keep = getActiveTransferKeepNames();
    for (const link of downloadLinksRef.current) {
      if (link.opfsEntryName) keep.add(link.opfsEntryName);
    }
    return keep;
  }, [getActiveTransferKeepNames]);

  const isStandaloneMode = () => isStandalonePwa();

  const emitRegisterDevice = useCallback(() => {
    socketRef.current?.emit('register_device', {
      device: detectDeviceKind(),
      standalone: isStandalonePwa(),
    });
  }, []);

  const refreshStorageSnapshot = useCallback(async () => {
    const snap = await getStorageSnapshot();
    setStorageSnapshot(snap);
    if (snap.quota) {
      const key = `${snap.usage}|${snap.quota}|${snap.available}`;
      if (lastLoggedStorageKey.current !== key) {
        lastLoggedStorageKey.current = key;
        log(L.storageBudget(formatStorageBrief(snap, langRef.current)));
      }
    }
    return snap;
  }, []);

  const lastStorageRefreshAt = useRef(0);
  const maybeRefreshStorageSnapshot = useCallback(() => {
    const now = Date.now();
    if (now - lastStorageRefreshAt.current < 2500) return;
    lastStorageRefreshAt.current = now;
    void refreshStorageSnapshot();
  }, [refreshStorageSnapshot]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshStorageSnapshot();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshStorageSnapshot]);

  const applyPurgedDownloadEntries = useCallback((removedNames: string[]) => {
    if (!removedNames.length) return;
    for (const name of removedNames) removeReceivedFileManifest(name);
    const removed = new Set(removedNames);
    setDownloadLinks((prev) => {
      const next: DownloadLink[] = [];
      for (const link of prev) {
        if (link.opfsEntryName && removed.has(link.opfsEntryName)) {
          try {
            URL.revokeObjectURL(link.url);
          } catch {
            /* ignore */
          }
          continue;
        }
        next.push(link);
      }
      return next;
    });
    log(L.opfsPurged(String(removedNames.length)));
  }, []);

  const purgeOpfsStagingSafe = useCallback(async () => {
    if (!hasOPFS()) return 0;
    const { removed, removedNames } = await purgeOpfsStaging(getOpfsKeepNames());
    const clearedFromList = removedNames.filter(
      (n) => !getActiveTransferKeepNames().has(n),
    );
    if (clearedFromList.length) applyPurgedDownloadEntries(clearedFromList);
    if (removed > 0) log(L.opfsPurged(String(removed)));
    await refreshStorageSnapshot();
    return removed;
  }, [getOpfsKeepNames, getActiveTransferKeepNames, applyPurgedDownloadEntries, refreshStorageSnapshot]);

  const prepareStorageForReceive = useCallback(
    async (incomingBytes: number) => {
      const room = await freeStorageForIncoming(
        incomingBytes,
        getOpfsKeepNames(),
        isStandaloneMode(),
      );
      if (room.purgedDownloadNames.length) {
        applyPurgedDownloadEntries(room.purgedDownloadNames);
      } else if (room.purgedStaging > 0) {
        log(L.opfsPurged(String(room.purgedStaging)));
      }
      await refreshStorageSnapshot();
      return room;
    },
    [getOpfsKeepNames, applyPurgedDownloadEntries, refreshStorageSnapshot],
  );

  useEffect(() => {
    try {
      sessionStorage.removeItem('vxh_chunk_reload');
      clearPageReloadingFlag();
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    return watchOtherClientSurface((surface) => setOtherClientSurface(surface));
  }, []);

  const opfsRestoredRef = useRef(false);
  const sessionBootDoneRef = useRef(false);

  const purgeAllReceivedStorage = useCallback(
    async (keepOpfs: ReadonlySet<string>) => {
      for (const link of downloadLinksRef.current) {
        if (link.opfsEntryName && keepOpfs.has(link.opfsEntryName)) continue;
        try {
          URL.revokeObjectURL(link.url);
        } catch {
          /* ignore */
        }
      }
      clearReceivedFileManifest();
      if (hasOPFS()) await purgeOpfsStaging(keepOpfs);
    },
    [],
  );

  useEffect(() => {
    void (async () => {
      const ok = await requestPersistentStorageIfPwa(isStandaloneMode());
      if (ok) log('Storage: PWA, pamięć trwała (większy limit)');

      if (!sessionBootDoneRef.current) {
        sessionBootDoneRef.current = true;
        const coldSession = isNewBrowserSession();
        markBrowserSession();
        if (coldSession) {
          const keep = getActiveTransferKeepNames();
          await purgeAllReceivedStorage(keep);
          setDownloadLinks([]);
          setPreviewItem(null);
          setZipListModal(null);
          opfsRestoredRef.current = true;
          await refreshStorageSnapshot();
          return;
        }
      }

      if (hasOPFS() && !opfsRestoredRef.current) {
        opfsRestoredRef.current = true;
        const stored = await listOpfsStoredEntries();
        if (stored.length) {
          const unknownSender =
            MESSAGES[langRef.current].unknownSender ?? MESSAGES.pl.unknownSender;
          setDownloadLinks((prev) => {
            const known = new Set(
              prev.map((l) => l.opfsEntryName).filter((n): n is string => !!n),
            );
            const restored: DownloadLink[] = [];
            let i = 0;
            for (const entry of stored) {
              if (known.has(entry.entryName)) continue;
              const manifest = getReceivedFileManifest(entry.entryName);
              const fileName = manifest?.fileName ?? displayNameFromOpfsEntry(entry.entryName);
              const file = entry.file;
              const ts = timestampFromOpfsEntry(entry.entryName);
              restored.push({
                id: Date.now() + i++,
                fileName,
                url: URL.createObjectURL(file),
                peerName: manifest?.peerName || unknownSender,
                mime: manifest?.mime || file.type || 'application/octet-stream',
                size: manifest?.size ?? file.size,
                file,
                receivedAt: manifest?.receivedAt || ts || Date.now(),
                batchId: manifest?.batchId,
                batchIndex: manifest?.batchIndex,
                batchTotal: manifest?.batchTotal,
                opfsEntryName: entry.entryName,
              });
            }
            const keep = new Set([
              ...prev.map((l) => l.opfsEntryName).filter((n): n is string => !!n),
              ...restored.map((l) => l.opfsEntryName).filter((n): n is string => !!n),
            ]);
            pruneReceivedFileManifest(keep);
            return restored.length ? [...prev, ...restored] : prev;
          });
        }
      }
      await refreshStorageSnapshot();
    })();
  }, [refreshStorageSnapshot, getActiveTransferKeepNames, purgeAllReceivedStorage]);

  useEffect(() => {
    const onBeforeUnload = () => {
      markPageReloading();
    };
    const onReloadKey = (e: KeyboardEvent) => {
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r')) {
        markPageReloading();
      }
    };
    const onPageHide = (e: PageTransitionEvent) => {
      if (e.persisted) return;
      if (isPageReloading()) return;
      // PWA/mobile: pagehide can fire when the OS opens a system sheet (downloads/share)
      // or the app goes briefly to background. Do not wipe OPFS/object URLs in that case.
      if (isStandalonePwa() || isMobile()) return;
      clearBrowserSessionMarker();
      const keep = getActiveTransferKeepNames();
      for (const link of downloadLinksRef.current) {
        if (link.opfsEntryName && keep.has(link.opfsEntryName)) continue;
        try {
          URL.revokeObjectURL(link.url);
        } catch {
          /* ignore */
        }
      }
      clearReceivedFileManifest();
      if (hasOPFS()) void purgeOpfsStaging(keep);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('keydown', onReloadKey);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('keydown', onReloadKey);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [getActiveTransferKeepNames]);

  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem('lang', lang);
  }, [lang]);

  const MAX_LOGS = 200;
  const safeStringify = (val: unknown): string => {
    try {
      if (typeof val === 'string') return val;
      if (val instanceof Error) return val.stack || val.message || String(val);
      return JSON.stringify(
        val,
        (() => {
          const seen = new WeakSet<object>();
          return (_key: string, value: unknown) => {
            if (typeof value === 'object' && value !== null) {
              if (seen.has(value)) return '[Circular]';
              seen.add(value);
            }
            return value;
          };
        })(),
        2
      );
    } catch {
      try {
        return String(val);
      } catch {
        return '[Unserializable value]';
      }
    }
  };

  const log = (msg: unknown) => {
    try {
      const text = safeStringify(msg);
      setMessages((prev) => {
        const next = [...prev, text];
        if (next.length > MAX_LOGS) next.splice(0, next.length - MAX_LOGS);
        return next;
      });
    } catch (e) {
      try {
        setMessages((prev) => [...prev, `⚠️ log error: ${safeErrMsg(e)}`]);
      } catch {
        /* ignore */
      }
    }
  };

  const L = LOGS[lang] || LOGS.pl;

  const tryStartPendingSend = (peerId: string) => {
    if (!isPeerReady(peerId)) return false;
    setConnectingPeer(null);
    const batch = sendBatches.current[peerId];
    const file = batch?.files[batch.index];
    if (!file) return false;
    setPendingSendPeerId(null);
    return startFileSend(peerId, file);
  };

  const isPeerReady = (peerId: string) =>
    fileChannels.current[peerId]?.readyState === 'open' &&
    ctrlChannels.current[peerId]?.readyState === 'open';

  /** Nawiązuje WebRTC bez aktualizacji UI — bezpieczne przed otwarciem okna plików. */
  const startPeerConnection = (peerId: string) => {
    if (!myName.trim()) return;
    if (isPeerReady(peerId)) return;
    if (!peerConnections.current[peerId]) createPeerConnection(peerId, true);
    socketRef.current?.emit('request_connection', peerId);
  };

  const ensureConnection = (peerId: string) => {
    if (!myName.trim()) return;
    if (isPeerReady(peerId)) return;
    setConnectingPeer(peerId);
    startPeerConnection(peerId);
  };

  const openFilePickerForPeer = (peerId: string) => {
    void requestPersistentStorageIfPwa(isStandaloneMode());
    startPeerConnection(peerId);
    document.getElementById(`file-input-${peerId}`)?.click();
  };

  const closeQuotaReceiveModal = () => {
    setQuotaReceiveModal(null);
    setQuotaModalShowPurge(false);
  };

  const refreshQuotaModalBudget = useCallback(async () => {
    const snap = await getStorageSnapshot();
    setQuotaReceiveModal((m) => {
      if (!m) return null;
      const reserved = getReservedIncomingBytes(m.peerId);
      return { ...m, availableBytes: Math.max(0, snap.available - reserved) };
    });
  }, []);

  const clearTransferProgress = (peerId: string) => {
    setTransferProgress((p) => {
      const n = { ...p };
      delete n[peerId];
      return n;
    });
  };

  const clearTransferUi = (peerId: string) => {
    delete sendReaders.current[peerId];
    delete activeSendFiles.current[peerId];
    if (quotaReceiveModal?.peerId === peerId) closeQuotaReceiveModal();
    delete recvForceDespiteQuota.current[peerId];
    clearTransferProgress(peerId);
  };

  const isSendCancelled = (peerId: string, err?: unknown) =>
    !!sendAbortFlags.current[peerId] ||
    (err instanceof Error && err.message === 'cancelled');

  /** Bytes persisted (OPFS offset / RAM batches flushed) — used for file_end checks. */
  const getReceivedBytes = (peerId: string) =>
    opfsWriters.current[peerId]
      ? opfsOffsets.current[peerId] || 0
      : receivedBytes.current[peerId] || 0;

  /** Includes not-yet-flushed inbound data — for progress UI only. */
  const getDisplayReceivedBytes = (peerId: string) => {
    if (opfsWriters.current[peerId]) {
      return getReceivedBytes(peerId) + getOpfsPendingBytes(peerId);
    }
    return getReceivedBytes(peerId) + (ramInboundBuf.current[peerId]?.byteLen || 0);
  };

  /** Bytes still needed for other active receives (excludes peer awaiting quota decision). */
  const getReservedIncomingBytes = (excludePeerId: string) => {
    let total = 0;
    for (const [pid, meta] of Object.entries(fileMetadata.current)) {
      if (pid === excludePeerId || !meta) continue;
      const active =
        !!opfsWriters.current[pid] ||
        (ramInboundBuf.current[pid]?.byteLen || 0) > 0 ||
        (Array.isArray(receivedBuffers.current[pid]) &&
          receivedBuffers.current[pid]!.length > 0);
      if (!active) continue;
      const pos = opfsOffsets.current[pid] || getReceivedBytes(pid) || 0;
      const remaining = Math.max(0, (meta.size || 0) - pos);
      total += bytesRequiredForReceive(remaining > 0 ? remaining : meta.size || 0);
    }
    return total;
  };

  const openQuotaReceiveModal = (
    peerId: string,
    meta: IncomingFileMeta,
    neededBytes: number,
    availableBytes: number,
    opts?: { keepProgress?: boolean },
  ) => {
    setQuotaModalShowPurge(false);
    setQuotaReceiveModal({
      peerId,
      neededBytes,
      availableBytes,
      fileName: meta.name || 'file',
    });
    if (!opts?.keepProgress) {
      setTransferProgress((p) => {
        const n = { ...p };
        delete n[peerId];
        return n;
      });
    }
  };

  const removePeerOpfsStaging = async (peerId: string) => {
    const entryName = opfsEntryNames.current[peerId];
    delete opfsEntryNames.current[peerId];
    if (entryName) await removeOpfsEntry(entryName);
  };

  const handleRecvQuotaExceeded = async (peerId: string) => {
    if (recvQuotaFailed.current[peerId]) return;
    if (recvForceDespiteQuota.current[peerId]) return;
    const meta = fileMetadata.current[peerId];
    if (!meta) return;
    recvQuotaFailed.current[peerId] = true;

    // iPhone Safari quota numbers are unreliable. Skip the quota modal with GB numbers.
    // Abort and show a generic warning instead.
    if (isIOS() && !isChromeIOS()) {
      try {
        ctrlChannels.current[peerId]?.send(
          JSON.stringify({ type: 'file_recv_denied', reason: 'quota' }),
        );
      } catch {
        /* ignore */
      }
      await abortReceive(peerId);
      setTransferInfo((prev) => ({
        ...prev,
        [peerId]: { text: t('transferQuotaError'), tone: 'warn' },
      }));
      return;
    }

    const snap = await getStorageSnapshot();
    log(L.quotaExceeded(formatStorageBrief(snap, lang)));
    const pos = opfsOffsets.current[peerId] || getReceivedBytes(peerId) || 0;
    const remaining = Math.max(0, (meta.size || 0) - pos);
    const needed = bytesRequiredForReceive(remaining > 0 ? remaining : meta.size || 0);
    const reserved = getReservedIncomingBytes(peerId);
    const effectiveAvailable = Math.max(0, snap.available - reserved);
    const ctrl = ctrlChannels.current[peerId];
    if (ctrl?.readyState === 'open' && !recvFlowPauseSent.current[peerId]) {
      try {
        recvFlowPauseSent.current[peerId] = true;
        ctrl.send(JSON.stringify({ type: 'flow_pause' }));
      } catch {
        /* ignore */
      }
    }
    openQuotaReceiveModal(peerId, meta, needed, effectiveAvailable, { keepProgress: true });
  };

  const abortReceive = async (peerId: string) => {
    const meta = fileMetadata.current[peerId];
    if (opfsWriters.current[peerId]) {
      try {
        const w = opfsWriters.current[peerId]!;
        if (typeof w.abort === 'function') await w.abort();
        else await w.close();
      } catch {
        /* ignore */
      }
      delete opfsWriters.current[peerId];
      delete opfsHandles.current[peerId];
    }
    await removePeerOpfsStaging(peerId);
    delete recvQuotaFailed.current[peerId];
    delete fileMetadata.current[peerId];
    delete receivedBuffers.current[peerId];
    delete receivedBytes.current[peerId];
    delete lastFileActivity.current[peerId];
    delete writeQueues.current[peerId];
    delete opfsOffsets.current[peerId];
    delete opfsInboundBuf.current[peerId];
    delete opfsInboundWriting.current[peerId];
    delete recvFlowPauseSent.current[peerId];
    delete transferTuning.current[peerId];
    delete ramInboundBuf.current[peerId];
    delete dbgChunks.current[peerId];
    delete resumeAttempts.current[peerId];
    delete activeSendFiles.current[peerId];
    delete sendBatches.current[peerId];
    delete pendingFileChunks.current[peerId];
    if (pendingSendPeerId === peerId) setPendingSendPeerId(null);
    clearTransferUi(peerId);
    if (meta?.name) {
      log(`CTRL anulowano odbiór: ${meta.name}`);
    }
  };

  const cancelSend = (peerId: string) => {
    sendAbortFlags.current[peerId] = true;
    delete sendFlowPaused.current[peerId];
    sendReaders.current[peerId]?.cancel().catch(() => {});
    delete sendReaders.current[peerId];
    delete activeSendFiles.current[peerId];
    delete sendBatches.current[peerId];
    clearFileInputForPeer(peerId);
    setPendingSendPeerId((id) => (id === peerId ? null : id));
    setConnectingPeer((id) => (id === peerId ? null : id));
    const ctrl = ctrlChannels.current[peerId];
    if (ctrl?.readyState === 'open') {
      try {
        ctrl.send(JSON.stringify({ type: 'file_cancel' }));
      } catch {
        /* ignore */
      }
    }
    clearTransferProgress(peerId);
    setTransferInfo((prev) => ({
      ...prev,
      [peerId]: { text: t('transferCancelled'), tone: 'warn' },
    }));
    log(L.sendError(whoLabel(peerNamesRef.current, peerId, langRef.current), 'anulowano'));
  };

  const cleanupPeer = (peerId: string) => {
    try {
      peerConnections.current[peerId]?.close();
    } catch {
      /* ignore */
    }
    delete peerConnections.current[peerId];

    try {
      ctrlChannels.current[peerId]?.close();
    } catch {
      /* ignore */
    }
    delete ctrlChannels.current[peerId];

    try {
      fileChannels.current[peerId]?.close();
    } catch {
      /* ignore */
    }
    delete fileChannels.current[peerId];

    clearTimeout(disconnectTimers.current[peerId]);
    delete disconnectTimers.current[peerId];

    if (opfsWriters.current[peerId]) opfsCloseWriter(peerId).catch(() => {});
    void removePeerOpfsStaging(peerId);
    delete opfsHandles.current[peerId];
    delete sendAbortFlags.current[peerId];
    delete sendReaders.current[peerId];
    delete resumeAttempts.current[peerId];
    delete activeSendFiles.current[peerId];
    delete sendBatches.current[peerId];
    delete pendingFileChunks.current[peerId];
    delete opfsInboundBuf.current[peerId];
    delete opfsInboundWriting.current[peerId];
    delete recvFlowPauseSent.current[peerId];
    delete sendFlowPaused.current[peerId];
    delete transferTuning.current[peerId];
    delete ramInboundBuf.current[peerId];
    setPendingSendPeerId((id) => (id === peerId ? null : id));

    setTransferProgress((p) => {
      const n = { ...p };
      delete n[peerId];
      return n;
    });
  };

  async function opfsOpenWriter(fileName: string): Promise<OpfsWriterResult> {
    if (!hasOPFS()) throw new Error('OPFS not supported on this browser');
    const root = await navigator.storage.getDirectory();
    const safeName = buildOpfsEntryName(fileName);
    const handle = await root.getFileHandle(safeName, { create: true });
    if (typeof handle.createWritable !== 'function') throw new Error('createWritable not available on OPFS handle');
    const writer = await handle.createWritable();
    return { handle, writer, name: safeName };
  }

  async function startOpfsReceiveForPeer(
    peerId: string,
    meta: IncomingFileMeta,
    opts?: { skipQuotaCheck?: boolean },
  ): Promise<OpfsReceiveStart> {
    if (!hasOPFS()) return 'ram-fallback';

    try {
      const incoming = meta.size || 0;
      // iPhone Safari (and iOS WebKit in general) frequently reports incorrect values in
      // navigator.storage.estimate(). Don't gate receives on that signal.
      const disableQuotaGuard = isIOS() && !isChromeIOS();

      if (!opts?.skipQuotaCheck && !disableQuotaGuard) {
        const prep = await prepareStorageForReceive(incoming);
        if (prep.purgedDownloadNames.length) {
          setTransferInfo((prev) => ({
            ...prev,
            [peerId]: {
              text: t('storagePurgedList', { count: String(prep.purgedDownloadNames.length) }),
              tone: 'info',
            },
          }));
        }
        const reserved = getReservedIncomingBytes(peerId);
        const effectiveAvailable = Math.max(0, prep.budget.available - reserved);
        const fitsWithActiveReceives =
          prep.required <= 0 ||
          prep.budget.quota === 0 ||
          prep.required <= effectiveAvailable;
        if (
          (!prep.ok || !fitsWithActiveReceives) &&
          !recvForceDespiteQuota.current[peerId]
        ) {
          const snap = await getStorageSnapshot();
          log(L.quotaExceeded(formatStorageBrief(snap, langRef.current)));
          log(
            L.recvDenied(
              `potrzeba ~${formatStorageDevTools(prep.required, langRef.current)}, wolne ${formatStorageDevTools(effectiveAvailable, langRef.current)}`,
            ),
          );
          openQuotaReceiveModal(peerId, meta, prep.required, effectiveAvailable);
          return 'quota-prompt';
        }
      }

      const { handle, writer, name: entryName } = await opfsOpenWriter(meta.name || 'file');
      opfsHandles.current[peerId] = handle;
      opfsWriters.current[peerId] = writer;
      opfsEntryNames.current[peerId] = entryName;
      opfsOffsets.current[peerId] = 0;
      delete recvQuotaFailed.current[peerId];
      log(L.opfsStart(meta.name || 'file'));

      const early = Array.isArray(receivedBuffers.current[peerId])
        ? receivedBuffers.current[peerId]!
        : [];
      if (early.length) {
        for (const ab of early) {
          enqueueOpfsWrite(peerId, new Uint8Array(ab));
        }
      }
      receivedBuffers.current[peerId] = null;
      return 'ok';
    } catch (e) {
      receivedBuffers.current[peerId] = [];
      const why = safeErrMsg(e);
      log(L.opfsFallback(why));
      if (isIOS() && isChromeIOS()) log(L.opfsChromeIOSNote());
      const ramLimit = isMobile() ? RECEIVE_RAM_LIMIT_MOBILE : RECEIVE_RAM_LIMIT_DESKTOP;
      if ((meta.size || 0) > ramLimit) log(L.bigRamWarning(fmtMB(meta.size || 0)));
      return 'ram-fallback';
    }
  }

  const bypassRecvQuotaGuard = (peerId: string) =>
    (isIOS() && !isChromeIOS()) || !!recvForceDespiteQuota.current[peerId];

  const drainRamInboundToOpfs = (peerId: string) => {
    const writer = opfsWriters.current[peerId];
    const acc = ramInboundBuf.current[peerId];
    if (!writer || !acc?.byteLen) return;
    for (const part of acc.parts) {
      if (part.byteLength) enqueueOpfsWrite(peerId, part);
    }
    acc.parts = [];
    acc.byteLen = 0;
    flushOpfsAccum(peerId, true);
  };

  const finishInboundFileSetup = (peerId: string) => {
    drainRamInboundToOpfs(peerId);
    const bumpRecvUi = () => {
      const total = fileMetadata.current[peerId]?.size || 0;
      setTransferProgress((p) => ({
        ...p,
        [peerId]: {
          mode: 'recv',
          total,
          received: getDisplayReceivedBytes(peerId),
          sent: 0,
        },
      }));
    };
    flushPendingFileChunks(peerId, bumpRecvUi);
    signalRecvReady(peerId);
  };

  const acceptQuotaReceive = async (peerId: string) => {
    if (quotaReceiveModal?.peerId !== peerId) return;
    closeQuotaReceiveModal();
    recvForceDespiteQuota.current[peerId] = true;
    delete recvQuotaFailed.current[peerId];
    const meta = fileMetadata.current[peerId];
    if (!meta) return;

    setTransferInfo((prev) => {
      const n = { ...prev };
      delete n[peerId];
      return n;
    });

    if (opfsWriters.current[peerId]) {
      const ctrl = ctrlChannels.current[peerId];
      if (recvFlowPauseSent.current[peerId] && ctrl?.readyState === 'open') {
        try {
          recvFlowPauseSent.current[peerId] = false;
          ctrl.send(JSON.stringify({ type: 'flow_resume' }));
        } catch {
          /* ignore */
        }
      }
      flushOpfsAccum(peerId, true);
      return;
    }

    setTransferProgress((p) => ({
      ...p,
      [peerId]: { mode: 'recv', total: meta.size || 0, received: 0, sent: 0 },
    }));

    const result = await startOpfsReceiveForPeer(peerId, meta, { skipQuotaCheck: true });
    if (result === 'quota-prompt' || result === 'error') {
      setTransferInfo((prev) => ({
        ...prev,
        [peerId]: { text: t('transferQuotaError'), tone: 'warn' },
      }));
      return;
    }
    finishInboundFileSetup(peerId);
  };

  const declineQuotaReceive = async (peerId: string) => {
    const prompt = quotaReceiveModal?.peerId === peerId ? quotaReceiveModal : null;
    closeQuotaReceiveModal();
    delete recvForceDespiteQuota.current[peerId];
    if (prompt) {
      log(
        L.recvDenied(
          `potrzeba ~${formatStorageDevTools(prompt.neededBytes, lang)}, wolne ${formatStorageDevTools(prompt.availableBytes, lang)}`,
        ),
      );
      try {
        ctrlChannels.current[peerId]?.send(
          JSON.stringify({
            type: 'file_recv_denied',
            reason: 'quota',
            needed: prompt.neededBytes,
            available: prompt.availableBytes,
          }),
        );
      } catch {
        /* ignore */
      }
    }
    await abortReceive(peerId);
    setTransferInfo((prev) => ({
      ...prev,
      [peerId]: { text: t('transferQuotaError'), tone: 'warn' },
    }));
  };

  async function opfsCloseWriter(peerId: string) {
    try {
      await opfsWriters.current[peerId]?.close();
    } catch {
      /* ignore */
    }
    const handle = opfsHandles.current[peerId];
    delete opfsWriters.current[peerId];
    if (!handle) return null;
    const file = await handle.getFile();
    return { handle, file };
  }

  const getOpfsPendingBytes = (peerId: string) => {
    const acc = opfsInboundBuf.current[peerId];
    return (acc?.byteLen || 0) + (opfsInboundWriting.current[peerId] || 0);
  };

  const signalRecvFlow = (peerId: string) => {
    if (!opfsWriters.current[peerId]) return;
    const ctrl = ctrlChannels.current[peerId];
    if (!ctrl || ctrl.readyState !== 'open') return;
    const pending = getOpfsPendingBytes(peerId);
    try {
      if (
        pending >= TRANSFER_CONFIG.RECV_BACKPRESSURE_PAUSE_BYTES &&
        !recvFlowPauseSent.current[peerId]
      ) {
        recvFlowPauseSent.current[peerId] = true;
        ctrl.send(JSON.stringify({ type: 'flow_pause' }));
      } else if (
        pending <= TRANSFER_CONFIG.RECV_BACKPRESSURE_RESUME_BYTES &&
        recvFlowPauseSent.current[peerId]
      ) {
        recvFlowPauseSent.current[peerId] = false;
        ctrl.send(JSON.stringify({ type: 'flow_resume' }));
      }
    } catch {
      /* ignore */
    }
  };

  const flushOpfsAccum = (peerId: string, force = false) => {
    if (recvQuotaFailed.current[peerId]) return;
    const writer = opfsWriters.current[peerId];
    const acc = opfsInboundBuf.current[peerId];
    if (!writer || !acc || !acc.byteLen) return;
    const batchTarget =
      transferTuning.current[peerId]?.opfsWriteBatch ?? TRANSFER_CONFIG.OPFS_WRITE_BATCH_BYTES;
    if (!force && acc.byteLen < batchTarget) return;

    const batch = concatUint8Parts(acc.parts, acc.byteLen);
    acc.parts = [];
    acc.byteLen = 0;
    const len = batch.byteLength;
    opfsInboundWriting.current[peerId] = (opfsInboundWriting.current[peerId] || 0) + len;

    const prev = writeQueues.current[peerId] || Promise.resolve();
    writeQueues.current[peerId] = prev
      .then(async () => {
        if (recvQuotaFailed.current[peerId] || !opfsWriters.current[peerId]) return;
        const pos = opfsOffsets.current[peerId] || 0;
        const total = fileMetadata.current[peerId]?.size || 0;
        if (
          !bypassRecvQuotaGuard(peerId) &&
          pos > 0 &&
          pos % (32 * 1024 * 1024) < len
        ) {
          const budget = await getStorageBudget();
          const remaining = Math.max(0, total - pos);
          const reserved = getReservedIncomingBytes(peerId);
          const effectiveAvailable = Math.max(0, budget.available - reserved);
          if (
            budget.quota > 0 &&
            bytesRequiredForReceive(remaining) > effectiveAvailable
          ) {
            await handleRecvQuotaExceeded(peerId);
            return;
          }
        }
        const writeBuf = batch.buffer.slice(
          batch.byteOffset,
          batch.byteOffset + batch.byteLength,
        ) as ArrayBuffer;
        await writer.write({ type: 'write', position: pos, data: writeBuf });
        opfsOffsets.current[peerId] = pos + len;
        receivedBytes.current[peerId] = opfsOffsets.current[peerId];
      })
      .catch(async (err) => {
        if (isQuotaExceededError(err)) {
          await handleRecvQuotaExceeded(peerId);
          return;
        }
        log(`OPFS write error: ${safeErrMsg(err)}`);
      })
      .finally(() => {
        opfsInboundWriting.current[peerId] = Math.max(
          0,
          (opfsInboundWriting.current[peerId] || 0) - len,
        );
        signalRecvFlow(peerId);
        const total = fileMetadata.current[peerId]?.size || 0;
        if (!total) return;
        setTransferProgress((p) => ({
          ...p,
          [peerId]: { mode: 'recv', total, received: getDisplayReceivedBytes(peerId), sent: 0 },
        }));
        maybeRefreshStorageSnapshot();
      });
  };

  const flushRamAccum = (peerId: string, force = false) => {
    const acc = ramInboundBuf.current[peerId];
    if (!acc || !acc.byteLen) return;
    const batchTarget = 256 * 1024;
    if (!force && acc.byteLen < batchTarget) return;
    const batch = concatUint8Parts(acc.parts, acc.byteLen);
    acc.parts = [];
    acc.byteLen = 0;
    if (!receivedBuffers.current[peerId]) receivedBuffers.current[peerId] = [];
    receivedBuffers.current[peerId]!.push(
      batch.buffer.slice(batch.byteOffset, batch.byteOffset + batch.byteLength) as ArrayBuffer,
    );
    receivedBytes.current[peerId] = (receivedBytes.current[peerId] || 0) + batch.byteLength;
  };

  const drainOpfsInbound = async (peerId: string) => {
    flushOpfsAccum(peerId, true);
    flushRamAccum(peerId, true);
    try {
      await (writeQueues.current[peerId] ?? Promise.resolve());
    } catch {
      /* ignore */
    }
    if (recvFlowPauseSent.current[peerId]) {
      recvFlowPauseSent.current[peerId] = false;
      const ctrl = ctrlChannels.current[peerId];
      try {
        ctrl?.readyState === 'open' && ctrl.send(JSON.stringify({ type: 'flow_resume' }));
      } catch {
        /* ignore */
      }
    }
  };

  async function waitQuietAfterFileEnd(peerId: string) {
    const total = fileMetadata.current[peerId]?.size || 0;
    if (!total) return;

    await drainOpfsInbound(peerId);

    const quietMs = quietMsForFileSize(total);
    const maxMs = quietMaxWaitForRemaining(Math.max(0, total - getReceivedBytes(peerId)));
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      await drainOpfsInbound(peerId);

      const written = getReceivedBytes(peerId);
      if (written >= total) {
        const idle = performance.now() - (lastFileActivity.current[peerId] || 0);
        if (idle >= quietMs) return;
      }

      await sleep(50);
    }
    log(`WARN: timeout oczekiwania na plik (${peerId}) got=${getReceivedBytes(peerId)} / ${total}`);
  }

  const enqueueOpfsWrite = (peerId: string, u8: Uint8Array) => {
    if (recvQuotaFailed.current[peerId]) return;
    const writer = opfsWriters.current[peerId];
    if (!writer || !u8.byteLength) return;

    if (!opfsInboundBuf.current[peerId]) {
      opfsInboundBuf.current[peerId] = { parts: [], byteLen: 0 };
    }
    const acc = opfsInboundBuf.current[peerId]!;
    acc.parts.push(u8);
    acc.byteLen += u8.byteLength;
    lastFileActivity.current[peerId] = performance.now();
    signalRecvFlow(peerId);

    const batchTarget =
      transferTuning.current[peerId]?.opfsWriteBatch ?? TRANSFER_CONFIG.OPFS_WRITE_BATCH_BYTES;
    if (acc.byteLen >= batchTarget) {
      flushOpfsAccum(peerId);
    }
  };

  const getInboundPendingBytes = (peerId: string) =>
    opfsWriters.current[peerId]
      ? getOpfsPendingBytes(peerId)
      : ramInboundBuf.current[peerId]?.byteLen || 0;

  const trimChunkToFileSize = (peerId: string, u8: Uint8Array): Uint8Array => {
    const total = fileMetadata.current[peerId]?.size || 0;
    if (!total) return u8;
    const pos = getReceivedBytes(peerId) + getInboundPendingBytes(peerId);
    const room = total - pos;
    if (room <= 0) return new Uint8Array(0);
    if (u8.byteLength <= room) return u8;
    return u8.subarray(0, room);
  };

  const applyIncomingFileChunk = (peerId: string, u8: Uint8Array, bumpUi: () => void) => {
    if (recvQuotaFailed.current[peerId]) return;
    if (!u8.byteLength) return;

    /** End-of-transfer marker from sender — must never be written into the file (breaks MP4/MOV). */
    if (u8.byteLength === 1 && u8[0] === 0) {
      lastFileActivity.current[peerId] = performance.now();
      return;
    }

    u8 = trimChunkToFileSize(peerId, u8);
    if (!u8.byteLength) {
      lastFileActivity.current[peerId] = performance.now();
      return;
    }

    lastFileActivity.current[peerId] = performance.now();

    try {
      const n = (dbgChunks.current[peerId] ?? 0) + 1;
      dbgChunks.current[peerId] = n;
      const written = getReceivedBytes(peerId);
      const pending = opfsWriters.current[peerId] ? getOpfsPendingBytes(peerId) : 0;
      if (n <= 3 || (written % (5 * 1024 * 1024)) < u8.byteLength) {
        log(
          `FILE chunk: +${u8.byteLength}B, written=${written}B${pending ? ` pending=${pending}B` : ''}`,
        );
      }
    } catch {
      /* ignore */
    }

    const writer = opfsWriters.current[peerId];
    if (writer) {
      enqueueOpfsWrite(peerId, u8);
    } else {
      if (!ramInboundBuf.current[peerId]) {
        ramInboundBuf.current[peerId] = { parts: [], byteLen: 0 };
      }
      const acc = ramInboundBuf.current[peerId]!;
      acc.parts.push(u8);
      acc.byteLen += u8.byteLength;
      if (acc.byteLen >= 256 * 1024) flushRamAccum(peerId);
    }

    bumpUi();
  };

  const flushPendingFileChunks = (peerId: string, bumpUi: () => void) => {
    const queued = pendingFileChunks.current[peerId];
    if (!queued?.length) return;
    delete pendingFileChunks.current[peerId];
    for (const u8 of queued) {
      applyIncomingFileChunk(peerId, u8, bumpUi);
    }
  };

  const signalRecvReady = (peerId: string) => {
    const ctrl = ctrlChannels.current[peerId];
    if (ctrl?.readyState !== 'open') return;
    try {
      ctrl.send(JSON.stringify({ type: 'file_recv_ready' }));
      log('CTRL: file_recv_ready wysłany');
    } catch {
      log('CTRL: file_recv_ready błąd wysyłki');
    }
  };

  const finalizeDownload = async (peerId: string) => {
    if (recvQuotaFailed.current[peerId]) return;
    const meta = fileMetadata.current[peerId];
    if (!meta) return;

    let url: string | undefined;
    let fileName: string | undefined;
    let fileObj: File | undefined;
    const mime = meta.type || meta.mime || 'application/octet-stream';

    const gotBefore = getReceivedBytes(peerId);
    log(
      `FINALIZE start: ${meta?.name} got=${gotBefore} size=${meta?.size || 0} mode=${opfsWriters.current[peerId] ? 'OPFS' : 'RAM'}`
    );

    if (opfsWriters.current[peerId]) {
      try {
        await writeQueues.current[peerId];
      } catch {
        /* ignore */
      }
      const res = await opfsCloseWriter(peerId);
      if (res?.file) {
        let outFile = res.file;
        if (meta.size && outFile.size > meta.size) {
          if (outFile.size - meta.size <= 1) {
            log(
              `FINALIZE: obcięto ${outFile.size - meta.size} B nadmiaru (sentinel/pending) → ${meta.size} B`
            );
            outFile = new File([outFile.slice(0, meta.size)], meta.name || 'file', {
              type: mime,
            });
          } else {
            log(
              `FINALIZE BŁĄD: ${meta.name} oczekiwano ${meta.size} B, zapisano ${outFile.size} B, plik niekompletny`
            );
            return;
          }
        } else if (meta.size && outFile.size < meta.size) {
          log(
            `FINALIZE BŁĄD: ${meta.name} oczekiwano ${meta.size} B, zapisano ${outFile.size} B, plik niekompletny`
          );
          return;
        }
        fileName = meta.name;
        fileObj = outFile;
        url = URL.createObjectURL(outFile);
        try {
          log(`FINALIZE OPFS file.size=${outFile.size}`);
        } catch {
          /* ignore */
        }
      }
    } else {
      const parts = receivedBuffers.current[peerId] || [];
      const blob = new Blob(parts, { type: mime });
      if (meta.size && blob.size !== meta.size) {
        log(`FINALIZE BŁĄD: ${meta.name} oczekiwano ${meta.size} B, blob ${blob.size} B`);
        return;
      }
      fileName = meta.name;
      fileObj = new File([blob], fileName || 'file', { type: mime });
      url = URL.createObjectURL(blob);
      try {
        log(`FINALIZE RAM blob.size=${blob.size}`);
      } catch {
        /* ignore */
      }
    }

    if (!url || !fileName) return;

    const opfsEntryName = opfsEntryNames.current[peerId];
    delete opfsEntryNames.current[peerId];

    const newDownloadLink: DownloadLink = {
      id: Date.now(),
      fileName,
      url,
      peerName: peerNamesRef.current[peerId] || peerId,
      mime,
      size: meta.size,
      file: fileObj,
      isNew: true,
      receivedAt: Date.now(),
      batchId: meta.batchId,
      batchIndex: meta.batchIndex,
      batchTotal: meta.batchTotal,
      opfsEntryName,
    };
    setDownloadLinks((prev) => [...prev, newDownloadLink]);

    if (opfsEntryName) {
      saveReceivedFileManifest({
        opfsEntryName,
        peerName: newDownloadLink.peerName,
        peerId,
        receivedAt: newDownloadLink.receivedAt,
        fileName: fileName || 'file',
        mime,
        size: meta.size,
        batchId: meta.batchId,
        batchIndex: meta.batchIndex,
        batchTotal: meta.batchTotal,
      });
    }

    setTimeout(() => {
      downloadsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    setTransferProgress((p) => ({ ...p, [peerId]: { sent: 0, received: 0, total: 0 } }));
    setTransferInfo((prev) => ({
      ...prev,
      [peerId]: { text: L.fileReceived(fileName), tone: 'info' },
    }));
    log(`FINALIZE done: link utworzony ${fileName}`);

    delete netBaseline.current[peerId];
    delete recvForceDespiteQuota.current[peerId];
    delete recvQuotaFailed.current[peerId];
    delete fileMetadata.current[peerId];
    delete receivedBuffers.current[peerId];
    delete opfsHandles.current[peerId];
    delete receivedBytes.current[peerId];
    delete lastFileActivity.current[peerId];
    delete writeQueues.current[peerId];
    delete opfsOffsets.current[peerId];
    delete opfsInboundBuf.current[peerId];
    delete opfsInboundWriting.current[peerId];
    delete recvFlowPauseSent.current[peerId];
    delete ramInboundBuf.current[peerId];
    delete transferTuning.current[peerId];
    void refreshStorageSnapshot();
  };

  const tuneFileChannel = (peerId: string, dc: RTCDataChannel) => {
    const pc = peerConnections.current[peerId];
    const sctp = pc?.sctp as (RTCSctpTransport & { maxMessageSize?: number }) | null;
    const max = sctp?.maxMessageSize || 256 * 1024;
    const tuning = pickTransferTuning(max, isMobile());
    transferTuning.current[peerId] = tuning;
    applyFileChannelTuning(dc, tuning);
    log(
      L.fileChunk(
        whoLabel(peerNamesRef.current, peerId, langRef.current),
        (tuning.chunkSize / 1024).toFixed(0),
      ),
    );
    return tuning;
  };

  const attachCtrlChannel = (peerId: string, dc: RTCDataChannel) => {
    ctrlChannels.current[peerId] = dc;

    dc.onopen = () => {
      log(L.ctrlOpen(whoLabel(peerNamesRef.current, peerId, langRef.current)));
      setTransferProgress((p) => {
        const n = { ...p };
        delete n[peerId];
        return n;
      });
      try {
        dc.send(JSON.stringify({ type: 'hello', agent: isMobile() ? 'mobile' : 'web', version }));
      } catch {
        /* ignore */
      }
      tryStartPendingSend(peerId);
    };

    dc.onmessage = async ({ data }) => {
      const dataStr = typeof data === 'string' ? data : String(data);
      try {
        const msg = JSON.parse(dataStr) as CtrlMessage;
        if (msg.type === 'hello') {
          peerAgent.current[peerId] = (msg as HelloMessage).agent || 'web';
          log(`CTRL hello od ${whoLabel(peerNamesRef.current, peerId, langRef.current)} agent=${peerAgent.current[peerId]}`);
          return;
        }
        if (msg.type === 'flow_pause') {
          sendFlowPaused.current[peerId] = true;
          return;
        }
        if (msg.type === 'flow_resume') {
          sendFlowPaused.current[peerId] = false;
          return;
        }
        if (msg.type === 'file_metadata') {
          const meta = (msg as FileMetadataMessage).metadata || {};
          fileMetadata.current[peerId] = meta;
          try {
            receivedBytes.current[peerId] = 0;
          } catch {
            /* ignore */
          }
          delete resumeAttempts.current[peerId];
          try {
            lastFileActivity.current[peerId] = 0;
          } catch {
            /* ignore */
          }
          try {
            writeQueues.current[peerId] = Promise.resolve();
          } catch {
            /* ignore */
          }
          opfsInboundBuf.current[peerId] = { parts: [], byteLen: 0 };
          ramInboundBuf.current[peerId] = { parts: [], byteLen: 0 };
          opfsInboundWriting.current[peerId] = 0;
          recvFlowPauseSent.current[peerId] = false;
          sendFlowPaused.current[peerId] = false;
          try {
            dbgChunks.current[peerId] = 0;
          } catch {
            /* ignore */
          }
          log(`META: ${meta?.name || 'file'} size=${meta?.size || 0} mime=${meta?.type || meta?.mime || ''}`);
          closeVideoPreviewForTransfer();

          receivedBuffers.current[peerId] = [];

          try {
            const pc = peerConnections.current[peerId];
            if (pc) {
              const { inn } = await readSctpBytes(pc);
              netBaseline.current[peerId] = {
                ...(netBaseline.current[peerId] || {}),
                in0: inn,
                out0: netBaseline.current[peerId]?.out0 ?? null,
              };
            }
          } catch {
            /* ignore */
          }

          setTransferProgress((p) => ({
            ...p,
            [peerId]: { mode: 'recv', total: meta.size || 0, received: 0, sent: 0 },
          }));

          const opfsResult = await startOpfsReceiveForPeer(peerId, meta);
          if (opfsResult === 'quota-prompt') return;
          if (opfsResult === 'error') {
            setTransferInfo((prev) => ({
              ...prev,
              [peerId]: { text: t('transferQuotaError'), tone: 'warn' },
            }));
            return;
          }
          if (opfsResult === 'ram-fallback') {
            log('INFO: brak OPFS → bufor RAM');
            receivedBuffers.current[peerId] = [];
            if (isIOS() && isChromeIOS()) log(L.opfsChromeIOSNote());
            const ramLimit = isMobile() ? RECEIVE_RAM_LIMIT_MOBILE : RECEIVE_RAM_LIMIT_DESKTOP;
            if ((meta.size || 0) > ramLimit) log(L.bigRamWarning(fmtMB(meta.size || 0)));
          }
          finishInboundFileSetup(peerId);
        } else if (msg.type === 'file_cancel') {
          log(`CTRL file_cancel od ${whoLabel(peerNamesRef.current, peerId, langRef.current)}`);
          await abortReceive(peerId);
          setTransferInfo((prev) => ({
            ...prev,
            [peerId]: { text: t('transferCancelledRemote'), tone: 'warn' },
          }));
        } else if (msg.type === 'file_end') {
          log(`CTRL file_end od ${whoLabel(peerNamesRef.current, peerId, langRef.current)}`);
          if (recvQuotaFailed.current[peerId]) return;
          try {
            await waitQuietAfterFileEnd(peerId);
          } catch {
            /* ignore */
          }
          if (recvQuotaFailed.current[peerId]) return;

          const meta = fileMetadata.current[peerId];
          const expected = meta?.size || 0;
          const got = getReceivedBytes(peerId);

          if (expected > 0 && got > expected + 1) {
            log(
              `FINALIZE BŁĄD: ${meta?.name}, za dużo danych (${got}/${expected} B), porzucam`
            );
            setTransferInfo((prev) => ({
              ...prev,
              [peerId]: { text: t('transferIncomplete'), tone: 'warn' },
            }));
            await abortReceive(peerId);
            return;
          }

          if (expected > 0 && got < expected) {
            resumeAttempts.current[peerId] = (resumeAttempts.current[peerId] || 0) + 1;
            const attempt = resumeAttempts.current[peerId];
            if (attempt <= TRANSFER_CONFIG.MAX_RESUME_ATTEMPTS) {
              log(L.recvIncomplete(String(got), String(expected), attempt));
              setTransferInfo((prev) => ({
                ...prev,
                [peerId]: {
                  text: t('transferRetrying', {
                    pct: String(Math.min(99, Math.floor((got / expected) * 100))),
                  }),
                  tone: 'info',
                },
              }));
              try {
                dc.send(
                  JSON.stringify({
                    type: 'file_incomplete',
                    got,
                    expected,
                  }),
                );
              } catch {
                log('CTRL: file_incomplete błąd wysyłki');
              }
              return;
            }
            log(`FINALIZE BŁĄD: ${meta?.name}, max prób uzupełnienia (${got}/${expected} B)`);
            setTransferInfo((prev) => ({
              ...prev,
              [peerId]: { text: t('transferIncomplete'), tone: 'warn' },
            }));
            await abortReceive(peerId);
            return;
          }

          await finalizeDownload(peerId);
          delete resumeAttempts.current[peerId];
          try {
            dc.send(JSON.stringify({ type: 'file_end_ack' }));
            log('CTRL: file_end_ack wysłany');
          } catch {
            log('CTRL: file_end_ack błąd wysyłki');
          }
        } else {
          log(L.ctrlMsg(whoLabel(peerNamesRef.current, peerId, langRef.current), dataStr));
        }
      } catch {
        log(L.ctrlMsg(whoLabel(peerNamesRef.current, peerId, langRef.current), dataStr));
      }
    };

    dc.onerror = (e: RTCErrorEvent) => {
      const err = e?.error;
      const details = err
        ? `${err.name || ''} ${err.message || ''} ${err.errorDetail || ''} sctp=${err.sctpCauseCode ?? ''}`
        : 'unknown';
      log(L.ctrlError(whoLabel(peerNamesRef.current, peerId, langRef.current), details));
    };
    dc.onclose = () => log(L.ctrlClosed(whoLabel(peerNamesRef.current, peerId, langRef.current)));
  };

  const attachFileChannel = (peerId: string, dc: RTCDataChannel) => {
    fileChannels.current[peerId] = dc;
    tuneFileChannel(peerId, dc);

    let lastUi = 0;
    dc.onopen = () => {
      log(L.fileOpen(whoLabel(peerNamesRef.current, peerId, langRef.current)));
      tryStartPendingSend(peerId);
    };

    dc.onmessage = async ({ data }) => {
      let u8: Uint8Array;
      if (data instanceof ArrayBuffer) {
        u8 = new Uint8Array(data);
      } else if (ArrayBuffer.isView(data)) {
        u8 = new Uint8Array(data.buffer, data.byteOffset || 0, data.byteLength || 0);
      } else if (data && typeof data === 'object' && 'buffer' in data && typeof (data as ArrayBufferView).byteLength === 'number') {
        const view = data as ArrayBufferView;
        u8 = new Uint8Array(view.buffer, view.byteOffset || 0, view.byteLength || 0);
      } else {
        u8 = new Uint8Array([]);
      }

      if (!fileMetadata.current[peerId]) {
        if (u8.byteLength) {
          if (!pendingFileChunks.current[peerId]) pendingFileChunks.current[peerId] = [];
          pendingFileChunks.current[peerId].push(u8.slice());
        }
        return;
      }

      const bumpUi = () => {
        const now = performance.now();
        if (now - lastUi > 100) {
          lastUi = now;
          const total = fileMetadata.current[peerId]?.size || 0;
          setTransferProgress((p) => ({
            ...p,
            [peerId]: {
              mode: 'recv',
              total: p[peerId]?.total || total,
              received: getDisplayReceivedBytes(peerId),
              sent: 0,
            },
          }));
          maybeRefreshStorageSnapshot();
        }
      };

      applyIncomingFileChunk(peerId, u8, bumpUi);
    };

    dc.onerror = (e: Event) => {
      const rtcErr = e as RTCErrorEvent;
      const err = rtcErr?.error;
      const details = err
        ? `${err.name || ''} ${err.message || ''} ${err.errorDetail || ''} sctp=${err.sctpCauseCode ?? ''}`
        : (e as ErrorEvent)?.message || 'unknown';
      log(L.fileError(whoLabel(peerNamesRef.current, peerId, langRef.current), details));
    };
    dc.onclose = () => log(L.fileClosed(whoLabel(peerNamesRef.current, peerId, langRef.current)));
  };

  const createPeerConnection = (peerId: string, isInitiator: boolean) => {
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 8,
      bundlePolicy: 'max-bundle',
    });
    peerConnections.current[peerId] = pc;

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        parseLocalCandidate(candidate);
        socketRef.current?.emit('signal', { to: peerId, signal: { type: 'candidate', candidate } });
      }
    };

    pc.oniceconnectionstatechange = () => {
      const st = pc.iceConnectionState;
      log(L.iceState(whoLabel(peerNamesRef.current, peerId, langRef.current), st));
      if (st === 'failed' || st === 'closed') {
        clearTimeout(disconnectTimers.current[peerId]);
        cleanupPeer(peerId);
      } else if (st === 'disconnected') {
        clearTimeout(disconnectTimers.current[peerId]);
        disconnectTimers.current[peerId] = setTimeout(() => {
          const cur = peerConnections.current[peerId];
          if (!cur) return;
          if (cur.iceConnectionState === 'disconnected') cleanupPeer(peerId);
        }, 10000);
      } else {
        clearTimeout(disconnectTimers.current[peerId]);
      }
    };

    pc.ondatachannel = ({ channel }) => {
      if (channel.label === 'ctrl') attachCtrlChannel(peerId, channel);
      else if (channel.label === 'file') attachFileChannel(peerId, channel);
    };

    if (isInitiator) {
      const ctrl = pc.createDataChannel('ctrl', { ordered: true });
      attachCtrlChannel(peerId, ctrl);

      const fast = pc.createDataChannel('file', { ordered: true });
      attachFileChannel(peerId, fast);

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() =>
          socketRef.current?.emit('signal', {
            to: peerId,
            signal: { type: 'offer', sdp: pc.localDescription?.sdp },
          })
        );
    }
    return pc;
  };

  useEffect(() => {
    const signalingUrl = window.location.origin;
    const socket = acquireSignalingSocket(signalingUrl);
    socketRef.current = socket;

    const onConnect = () => {
      wasConnectedRef.current = true;
      setServerUnavailable(false);
      const id = socket.id ?? '';
      setSocketId(id);
      setConnected(true);
      socket.emit('register_device', {
        device: detectDeviceKind(),
        standalone: isStandalonePwa(),
      });
      const stored = localStorage.getItem('myWebRTCName');
      if (stored?.trim()) {
        setMyName(stored);
        socket.emit('register_name', stored);
      }
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    const onConnectError = () => {
      setConnected(false);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    if (socket.connected) onConnect();

    socket.on('assigned_name', ({ name, shortId: sid }: { name: string; shortId: string }) => {
      setShortId(sid);
      log(L.connectedWithId(sid));
      if (!localStorage.getItem('myWebRTCName')?.trim()) {
        setMyName(name);
        localStorage.setItem('myWebRTCName', name);
      }
    });

    socket.on('local_peers_update', (peersWithNames: Peer[]) => {
      setPeers(peersWithNames);
      const namesMap = Object.fromEntries(peersWithNames.map((p) => [p.id, p.name]));
      setPeerNames(namesMap);
    });

    socket.on('signal', async ({ from, signal }: { from: string; signal: SignalPayload }) => {
      const pc = peerConnections.current[from] || createPeerConnection(from, false);
      try {
        if (signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('signal', { to: from, signal: { type: 'answer', sdp: answer.sdp } });
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
        } else if (signal.type === 'candidate' && signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      } catch (err) {
        console.error(err);
        log(L.signalError(whoLabel(peerNamesRef.current, from, langRef.current), safeErrMsg(err)));
      }
    });

    socket.on('incoming_connection_request', (requesterId: string) =>
      setIncomingConnectionRequest(requesterId)
    );
    socket.on('peer_disconnected', (peerId: string) => cleanupPeer(peerId));

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('assigned_name');
      socket.off('local_peers_update');
      socket.off('signal');
      socket.off('incoming_connection_request');
      socket.off('peer_disconnected');
      releaseSignalingSocket();
      Object.keys(peerConnections.current).forEach(cleanupPeer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (connected) {
      setServerUnavailable(false);
      return;
    }
    const delay = wasConnectedRef.current ? SERVER_OFFLINE_RECONNECT_MS : SERVER_OFFLINE_GRACE_MS;
    const timer = window.setTimeout(() => setServerUnavailable(true), delay);
    return () => window.clearTimeout(timer);
  }, [connected]);

  const parseLocalCandidate = (cand: RTCIceCandidate) => {
    const parts = cand.candidate?.split(' ') ?? [];
    const address = parts[4];
    const type = parts[7];
    if (type === 'host' && address) {
      const isPrivate = /^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(address);
      if (isPrivate && address !== '127.0.0.1') setLocalIps((prev) => new Set(prev).add(address));
    }
  };

  const scrollLogsToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = logsPanelRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const handleLogsScroll = useCallback(() => {
    const el = logsPanelRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    logsStickToBottom.current = dist < 20;
  }, []);

  useEffect(() => {
    if (!showLogs || !logsStickToBottom.current) return;
    const id = requestAnimationFrame(() => scrollLogsToBottom('smooth'));
    return () => cancelAnimationFrame(id);
  }, [messages, showLogs, scrollLogsToBottom]);

  const registerName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || !socketRef.current) return;
    socketRef.current.emit('register_name', trimmed);
    localStorage.setItem('myWebRTCName', trimmed);
    setMyName(trimmed);
  };

  const queueFilesForPeer = (peerId: string, files: File[]) => {
    if (!files.length) return;

    delete sendAbortFlags.current[peerId];
    const existing = sendBatches.current[peerId];
    if (existing && existing.index < existing.files.length) {
      existing.files.push(...files);
      if (isPeerReady(peerId) && !activeSendFiles.current[peerId]) {
        tryStartPendingSend(peerId);
      }
      return;
    }

    const batchId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    sendBatches.current[peerId] = { files: [...files], index: 0, batchId };

    if (isPeerReady(peerId)) {
      tryStartPendingSend(peerId);
      return;
    }

    setPendingSendPeerId(peerId);
    setConnectingPeer(peerId);
    startPeerConnection(peerId);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, peerId: string) => {
    const files = pickSelectedFiles(e.target.files);
    if (!files.length) return;
    queueFilesForPeer(peerId, files);
  };

  const handleQuickSendText = (peerId: string, text: string) => {
    ensureConnection(peerId);
    queueFilesForPeer(peerId, [textToNoteFile(text)]);
  };

  const handleQuickSendFile = (peerId: string, file: File) => {
    ensureConnection(peerId);
    queueFilesForPeer(peerId, [file]);
  };

  const completeFileSend = (peerId: string, file: File) => {
    if (sendAbortFlags.current[peerId]) return;

    log(L.sendDone(whoLabel(peerNamesRef.current, peerId, langRef.current)));

    const batch = sendBatches.current[peerId];
    if (batch && batch.index + 1 < batch.files.length) {
      batch.index += 1;
      setTransferInfo((prev) => ({
        ...prev,
        [peerId]: { text: L.fileSent(file.name), tone: 'info' },
      }));
      if (!startFileSend(peerId, batch.files[batch.index])) {
        setPendingSendPeerId(peerId);
      }
      return;
    }

    const totalSent = batch?.files.length || 1;
    delete sendBatches.current[peerId];
    clearFileInputForPeer(peerId);
    setTransferInfo((prev) => ({
      ...prev,
      [peerId]: {
        text:
          totalSent > 1
            ? t('batchSent', { count: String(totalSent) })
            : L.fileSent(file.name),
        tone: 'info',
      },
    }));
    clearTransferUi(peerId);
    void refreshStorageSnapshot();
  };

  const closeVideoPreviewForTransfer = () => {
    setPreviewItem((prev) => {
      if (!prev || !isVideoDownloadLink(prev)) return prev;
      log(
        MESSAGES[langRef.current].previewClosedForTransfer ??
          MESSAGES.pl.previewClosedForTransfer,
      );
      releasePreviewBlobUrl();
      return null;
    });
  };

  const hasActiveFileTransfer = () =>
    Object.values(transferProgress).some((tp) => (tp?.total || 0) > 0);

  function startFileSend(peerId: string, file: File): boolean {
    if (!isPeerReady(peerId)) {
      setPendingSendPeerId(peerId);
      return false;
    }
    closeVideoPreviewForTransfer();
    const fileDc = fileChannels.current[peerId]!;
    const ctrlDc = ctrlChannels.current[peerId]!;

    if (!file.size) {
      log(`⚠️ Plik „${file.name}” ma rozmiar 0 B. Pomijam.`);
      completeFileSend(peerId, file);
      return true;
    }

    setConnectingPeer(null);
    setPendingSendPeerId(null);
    delete sendAbortFlags.current[peerId];

    const batch = sendBatches.current[peerId];
    const batchIndex = batch ? batch.index + 1 : 1;
    const batchTotal = batch?.files.length || 1;

    setTransferProgress((p) => ({
      ...p,
      [peerId]: {
        mode: 'send',
        sent: 0,
        total: file.size,
        received: 0,
        batchIndex,
        batchTotal,
        fileName: file.name,
      },
    }));

    (async () => {
      try {
        const pc = peerConnections.current[peerId];
        if (pc) {
          const { out } = await readSctpBytes(pc);
          netBaseline.current[peerId] = {
            ...(netBaseline.current[peerId] || {}),
            out0: out,
            in0: netBaseline.current[peerId]?.in0 ?? null,
          };
        }
      } catch {
        /* ignore */
      }
    })();

    const tuning = transferTuning.current[peerId] ?? pickTransferTuning(256 * 1024, isMobile());
    applyFileChannelTuning(fileDc, tuning);
    transferTuning.current[peerId] = tuning;
    activeSendFiles.current[peerId] = file;
    resumeAttempts.current[peerId] = 0;

    finishFileSend(peerId, file)
      .then(() => completeFileSend(peerId, file))
      .catch((err) => {
        if (isSendCancelled(peerId, err)) {
          delete sendAbortFlags.current[peerId];
          clearTransferUi(peerId);
          return;
        }
        const batch = sendBatches.current[peerId];
        if (batch && batch.index + 1 < batch.files.length) {
          log(
            `⚠️ ${file.name}: ${safeErrMsg(err)}. Przechodzę do następnego pliku w kolejce.`,
          );
          batch.index += 1;
          if (!startFileSend(peerId, batch.files[batch.index])) {
            setPendingSendPeerId(peerId);
          }
          return;
        }
        delete sendBatches.current[peerId];
        clearFileInputForPeer(peerId);
        log(L.sendError(whoLabel(peerNamesRef.current, peerId, langRef.current), safeErrMsg(err)));
        clearTransferUi(peerId);
      });
    return true;
  }

  async function finishFileSend(peerId: string, file: File) {
    const fileDc = fileChannels.current[peerId];
    const ctrlDc = ctrlChannels.current[peerId];
    if (!fileDc || fileDc.readyState !== 'open' || !ctrlDc || ctrlDc.readyState !== 'open') {
      throw new Error('data channel not open');
    }

    const tuning = transferTuning.current[peerId] ?? pickTransferTuning(256 * 1024, isMobile());
    const ackTimeout = ackTimeoutForFileSize(file.size);
    let offset = 0;
    let resumeRound = 0;

    const readyPromise = waitForRecvReady(ctrlDc, Math.min(30_000, ackTimeout));
    const batch = sendBatches.current[peerId];
    const batchTotal = batch?.files.length || 1;
    ctrlDc.send(
      JSON.stringify({
        type: 'file_metadata',
        metadata: {
          name: file.name,
          type: file.type,
          size: file.size,
          origin: isMobile() ? 'mobile' : 'web',
          ...(batchTotal > 1 && batch
            ? {
                batchId: batch.batchId,
                batchIndex: batch.index + 1,
                batchTotal,
              }
            : {}),
        },
      }),
    );
    const recvReady = await readyPromise;
    if (recvReady === 'denied') {
      throw new Error('receiver browser storage full');
    }
    if (recvReady !== 'ready') {
      log('WARN: brak file_recv_ready, wysyłam mimo to');
    }

    while (resumeRound <= TRANSFER_CONFIG.MAX_RESUME_ATTEMPTS) {
      if (sendAbortFlags.current[peerId]) throw new Error('cancelled');

      await sendBlobChunks(fileDc, file, {
        chunkSize: tuning.chunkSize,
        bufferedLow: tuning.bufferedLow,
        bufferedHigh: tuning.bufferedHigh,
        startByteOffset: offset,
        baseOffset: offset,
        totalSize: file.size,
        abort: () => !!sendAbortFlags.current[peerId],
        waitIfPaused: async () => {
          while (sendFlowPaused.current[peerId]) {
            await sleep(25);
          }
        },
        onProgress: (sent) => {
          if (sendAbortFlags.current[peerId]) return;
          const batch = sendBatches.current[peerId];
          setTransferProgress((p) => ({
            ...p,
            [peerId]: {
              mode: 'send',
              sent,
              total: file.size,
              received: 0,
              batchIndex: batch ? batch.index + 1 : undefined,
              batchTotal: batch?.files.length,
              fileName: file.name,
            },
          }));
        },
      });

      const flushedOk = await waitAllFlushed(fileDc, 0);
      if (!flushedOk) {
        log(`WARN: bufor nadawcy nie opróżniony (${fileDc.bufferedAmount} B)`);
      }
      if (sendAbortFlags.current[peerId]) throw new Error('cancelled');

      await sendBinaryWithRetry(fileDc, new Uint8Array([0]), {
        abort: () => !!sendAbortFlags.current[peerId],
        threshold: tuning.bufferedLow,
        highWatermark: tuning.bufferedHigh,
      });
      await waitAllFlushed(fileDc, 0);
      if (sendAbortFlags.current[peerId]) throw new Error('cancelled');

      if (sendAbortFlags.current[peerId]) throw new Error('cancelled');

      setTransferInfo((prev) => {
        if (sendAbortFlags.current[peerId]) return prev;
        return {
          ...prev,
          [peerId]: { text: t('transferConfirming'), tone: 'info' },
        };
      });

      let incompleteOffset = -1;
      const result = await waitForSendComplete(
        ctrlDc,
        (got) => {
          incompleteOffset = got;
        },
        ackTimeout,
      );

      if (sendAbortFlags.current[peerId]) throw new Error('cancelled');

      if (result === 'ack') {
        delete activeSendFiles.current[peerId];
        delete resumeAttempts.current[peerId];
        return;
      }

      if (
        result === 'incomplete' &&
        incompleteOffset >= 0 &&
        incompleteOffset < file.size
      ) {
        resumeRound += 1;
        offset = incompleteOffset;
        log(L.sendResume(String(offset), String(file.size), resumeRound));
        setTransferInfo((prev) => ({
          ...prev,
          [peerId]: {
            text: t('transferRetrying', {
              pct: String(Math.min(99, Math.floor((offset / file.size) * 100))),
            }),
            tone: 'info',
          },
        }));
        continue;
      }

      throw new Error(
        result === 'timeout'
          ? 'timeout waiting for receiver confirmation'
          : 'transfer incomplete',
      );
    }

    throw new Error('max resume attempts exceeded');
  }

  async function readSctpBytes(pc: RTCPeerConnection) {
    const stats = await pc.getStats();
    let out = 0;
    let inn = 0;
    stats.forEach((r) => {
      if (r.type === 'sctp-transport') {
        const sctp = r as RTCStats & { bytesSent?: number; bytesReceived?: number };
        out += sctp.bytesSent || 0;
        inn += sctp.bytesReceived || 0;
      }
    });
    return { out, inn };
  }

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallButton(true);
    };
    const handleAppInstalled = () => setIsStandalone(true);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    const ua = window.navigator.userAgent.toLowerCase();
    const win = window as Window & { MSStream?: unknown };
    setDeviceHints({
      ios: /iphone|ipad|ipod/.test(ua) && !win.MSStream,
      android: /android/.test(ua),
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    const syncStandalone = () => {
      const standalone = isStandalonePwa();
      setIsStandalone(standalone);
      if (standalone) document.body.classList.add('is-pwa');
      else document.body.classList.remove('is-pwa');
    };
    syncStandalone();
    const onDisplayModeChange = () => {
      syncStandalone();
      emitRegisterDevice();
      if (isStandalonePwa()) {
        void requestPersistentStorageIfPwa(true).then(() => refreshStorageSnapshot());
      }
    };
    const unwatchDisplay = watchPwaDisplayMode(onDisplayModeChange);
    if (isStandalonePwa()) {
      void requestPersistentStorageIfPwa(true).then(() => refreshStorageSnapshot());
    }
    return () => {
      unwatchDisplay();
      document.body.classList.remove('is-pwa');
    };
  }, [emitRegisterDevice, refreshStorageSnapshot]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowInstallButton(false);
    if (outcome === 'accepted') setIsStandalone(true);
  };

  const showPwaBar = !isStandalone && (showInstallButton || deviceHints.ios);

  const isTextReadable = (link: DownloadLink) => {
    const mt = (link?.mime || '').toLowerCase();
    const name = (link?.fileName || '').toLowerCase();
    return mt.startsWith('text/') || /\.txt$/i.test(name);
  };

  const isZipListable = (link: DownloadLink) =>
    isZipArchiveName(link.fileName || '', link.mime || '');

  const openZipList = async (link: DownloadLink) => {
    if (!link.url && !link.file) return;
    setZipListModal({
      linkId: link.id,
      archiveName: link.fileName || 'archive.zip',
      entries: [],
      loading: true,
      error: null,
    });
    try {
      const source = link.file ?? link.url;
      const entries = await listZipEntries(source, link.size ?? link.file?.size);
      setZipListModal({
        linkId: link.id,
        archiveName: link.fileName || 'archive.zip',
        entries,
        loading: false,
        error: null,
      });
    } catch (e) {
      setZipListModal({
        linkId: link.id,
        archiveName: link.fileName || 'archive.zip',
        entries: [],
        loading: false,
        error: safeErrMsg(e),
      });
    }
  };

  const isPreviewable = (link: DownloadLink) => {
    if (isTextReadable(link)) {
      const size = link.size ?? 0;
      return size <= 512 * 1024;
    }
    if (isAudioLink(link)) return true;
    const mt = (link?.mime || '').toLowerCase();
    if (mt.startsWith('image/') || mt.startsWith('video/')) return true;
    const name = (link?.fileName || '').toLowerCase();
    return /\.(png|jpe?g|gif|webp|bmp|svg|mp4|webm|mov|m4v)$/i.test(name);
  };

  const releasePreviewBlobUrl = () => {
    if (!previewBlobUrlRef.current) return;
    try {
      URL.revokeObjectURL(previewBlobUrlRef.current);
    } catch {
      /* ignore */
    }
    previewBlobUrlRef.current = null;
  };

  const openPreview = (link: DownloadLink) => {
    if (!isPreviewable(link)) return;
    if (hasActiveFileTransfer() && isVideoDownloadLink(link)) {
      log(t('previewClosedForTransfer'));
      return;
    }
    if (!link.url && !link.file) {
      log('⚠️ Brak adresu podglądu. Odśwież stronę lub zapisz plik na dysk.');
      return;
    }
    releasePreviewBlobUrl();
    const url = link.file ? URL.createObjectURL(link.file) : link.url;
    if (link.file) previewBlobUrlRef.current = url;
    setPreviewItem({ ...link, url });
  };

  const shiftBundlePreview = useCallback(
    (dir: -1 | 1) => {
      setPreviewItem((current) => {
        if (!current) return current;
        const neighbor = findBundlePreviewNeighbor(downloadLinks, current, dir, isPreviewable);
        if (!neighbor?.url && !neighbor?.file) return current;
        releasePreviewBlobUrl();
        const url = neighbor.file ? URL.createObjectURL(neighbor.file) : neighbor.url;
        if (neighbor.file) previewBlobUrlRef.current = url;
        return { ...neighbor, url };
      });
    },
    [downloadLinks],
  );

  const closePreview = () => {
    releasePreviewBlobUrl();
    setPreviewItem(null);
  };

  const markFilesSaved = (ids: number[]) => {
    const idSet = new Set(ids);
    setDownloadLinks((prev) => prev.map((x) => (idSet.has(x.id) ? { ...x, isNew: false } : x)));
  };

  const saveFile = async (item: DownloadLink) => {
    try {
      // iOS Safari: downloading MP4 from blob: via <a download> often fails with
      // "WebKitBlobResource". Prefer the system share sheet when possible.
      if (deviceHints.ios && item.file && navigator.canShare?.({ files: [item.file] })) {
        await navigator.share({
          files: [item.file],
          title: item.fileName || 'file',
        });
        markFilesSaved([item.id]);
        return;
      }

      const a = document.createElement('a');
      a.href = item.url;
      a.download = item.fileName || 'file';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      markFilesSaved([item.id]);
      if (item.opfsEntryName) {
        const entry = item.opfsEntryName;
        removeReceivedFileManifest(entry);
        void removeOpfsEntry(entry).then(() => refreshStorageSnapshot());
        setDownloadLinks((prev) =>
          prev.map((x) => (x.id === item.id ? { ...x, opfsEntryName: undefined } : x)),
        );
      }
    } catch {
      /* ignore */
    }
  };

  const savePreview = (item: DownloadLink) => saveFile(item);

  const previewBundlePrev = previewItem
    ? findBundlePreviewNeighbor(downloadLinks, previewItem, -1, isPreviewable)
    : null;
  const previewBundleNext = previewItem
    ? findBundlePreviewNeighbor(downloadLinks, previewItem, 1, isPreviewable)
    : null;
  const showBundlePreviewNav =
    !!previewItem?.batchId && (previewItem.batchTotal ?? 0) > 1;

  useEffect(() => {
    if (!showBundlePreviewNav || !previewItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        shiftBundlePreview(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        shiftBundlePreview(1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showBundlePreviewNav, previewItem, shiftBundlePreview]);

  const removeDownloadLinksByIds = useCallback((ids: number[]) => {
    const idSet = new Set(ids);
    if (!idSet.size) return;
    setDownloadLinks((prev) => {
      for (const toRemove of prev) {
        if (!idSet.has(toRemove.id)) continue;
        try {
          URL.revokeObjectURL(toRemove.url);
        } catch {
          /* ignore */
        }
        if (toRemove.opfsEntryName) {
          removeReceivedFileManifest(toRemove.opfsEntryName);
          void removeOpfsEntry(toRemove.opfsEntryName);
        }
      }
      const next = prev.filter((x) => !idSet.has(x.id));
      if (previewItem && idSet.has(previewItem.id)) {
        releasePreviewBlobUrl();
        setPreviewItem(null);
      }
      return next;
    });
    void refreshStorageSnapshot().then(() => {
      if (quotaReceiveModal) void refreshQuotaModalBudget();
    });
  }, [previewItem, quotaReceiveModal, refreshQuotaModalBudget]);

  const deleteItem = (itemId: number) => {
    removeDownloadLinksByIds([itemId]);
  };

  const deleteAllReceivedFiles = useCallback(() => {
    const ids = downloadLinksRef.current.map((l) => l.id);
    if (!ids.length) return;
    setZipListModal(null);
    removeDownloadLinksByIds(ids);
  }, [removeDownloadLinksByIds]);

  const quotaPurgeLinks = [...downloadLinks].sort(
    (a, b) => (a.receivedAt ?? 0) - (b.receivedAt ?? 0),
  );

  const canSendToPeer = useCallback(
    (peerId: string) => {
      if (!connected || !myName.trim()) return false;
      const tp = transferProgress[peerId];
      const isTransferring = (tp?.total || 0) > 0;
      const isSending = isTransferring && tp?.mode === 'send';
      const isReceiving = isTransferring && tp?.mode === 'recv';
      return !isSending && !isReceiving && pendingSendPeerId !== peerId;
    },
    [connected, myName, transferProgress, pendingSendPeerId],
  );

  const fileDropReady = connected && !!myName.trim();

  const fileDrop = useFileDrop({
    enabled: fileDropReady,
    getEligiblePeers: () => peers.map((p) => ({ id: p.id, name: p.name })),
    canSendToPeer,
    cloneFiles: async (list) => pickSelectedFiles(list),
    onSend: (peerId, files) => queueFilesForPeer(peerId, files),
    onError: (code) => {
      if (code === 'dropNeedSetup') {
        log(!connected ? t('dropNeedConnection') : t('dropOverlayNeedName'));
      } else if (code === 'dropNoDevices') {
        log(t('dropNoDevices'));
      } else if (code === 'dropPickDevice') {
        log(t('dropPickDevice'));
      } else if (code === 'dropPeerBusy') {
        log(t('dropPeerBusy'));
      } else {
        log(`⚠️ ${code}`);
      }
    },
  });

  return (
    <div className="app-container share-app">
      <div className="top-bar">
        <div className="lang-text">
          <button type="button" className={lang === 'pl' ? 'active' : ''} onClick={() => setLang('pl')}>
            PL
          </button>
          <span>|</span>
          <button type="button" className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>
            EN
          </button>
        </div>
        <span
          className={`status-pill ${connected ? 'on' : ''} ${serverUnavailable ? 'err' : ''}`}
        >
          {connected ? t('online') : serverUnavailable ? t('serverOffline') : t('offline')}
        </span>
      </div>

      <header className="app-header">
        <h1 className="app-title">{t('appTitle')}</h1>
        <p className="app-subtitle web-only">{t('appSubtitle')}</p>
      </header>

      {otherClientSurface ? (
        <div className="dual-surface-banner" role="status">
          {formatDualSurfaceWarning(otherClientSurface, lang)}
        </div>
      ) : null}

      {isMobile() ? (
        <div className="mobile-share-guide">
          <ShareStrip lang={lang} />
          {!isStandalone && (
            <details className="app-guide__recommendations app-guide__recommendations--mobile">
              <summary className="app-guide__recommendations-summary">{t('recommendationsTitle')}</summary>
              <div className="app-guide__recommendations-body">
                <p className="app-guide__recommendations-heading">{t('pwaMobileTitle')}</p>
                <p className="app-guide__recommendations-text">
                  {deviceHints.ios
                    ? t('pwaMobileBodyIos')
                    : deviceHints.android
                      ? t('pwaMobileBodyAndroid')
                      : t('pwaMobileBodyAndroid')}
                </p>
                {deviceHints.ios ? (
                  <ol className="app-guide__pwa-steps">
                    <li className="app-guide__pwa-step">
                      <span className="app-guide__pwa-step-icon" aria-hidden>
                        <IconShareIos size={36} />
                      </span>
                      <span>{t('pwaMobileStepShare')}</span>
                    </li>
                    <li className="app-guide__pwa-step">
                      <span className="app-guide__pwa-step-icon app-guide__pwa-step-icon--add" aria-hidden>
                        +
                      </span>
                      <span>{t('pwaMobileStepAdd')}</span>
                    </li>
                    <li className="app-guide__pwa-step">
                      <span className="app-guide__pwa-step-icon app-guide__pwa-step-icon--home" aria-hidden>
                        ⌂
                      </span>
                      <span>{t('pwaMobileStepOpen')}</span>
                    </li>
                  </ol>
                ) : deviceHints.android ? (
                  <>
                    {showInstallButton ? (
                      <button
                        type="button"
                        className="pwa-install-btn pwa-install-btn--labeled app-guide__pwa-install-first"
                        onClick={handleInstallClick}
                      >
                        {t('installAppBtn')}
                      </button>
                    ) : null}
                    <ol className="app-guide__pwa-steps">
                      <li className="app-guide__pwa-step">
                        <span
                          className="app-guide__pwa-step-icon app-guide__pwa-step-icon--glyph"
                          aria-hidden
                        >
                          ⋮
                        </span>
                        <span>{t('pwaAndroidStepMenu')}</span>
                      </li>
                      <li className="app-guide__pwa-step">
                        <span
                          className="app-guide__pwa-step-icon app-guide__pwa-step-icon--glyph"
                          aria-hidden
                        >
                          ⬇
                        </span>
                        <span>{t('pwaAndroidStepInstall')}</span>
                      </li>
                      <li className="app-guide__pwa-step">
                        <span className="app-guide__pwa-step-icon app-guide__pwa-step-icon--home" aria-hidden>
                          ⌂
                        </span>
                        <span>{t('pwaAndroidStepOpen')}</span>
                      </li>
                    </ol>
                  </>
                ) : showInstallButton ? (
                  <button
                    type="button"
                    className="pwa-install-btn pwa-install-btn--labeled"
                    onClick={handleInstallClick}
                  >
                    {t('installAppBtn')}
                  </button>
                ) : null}
              </div>
            </details>
          )}
        </div>
      ) : (
        <div className="web-only">
          <ShareStrip lang={lang} />
        </div>
      )}

      {serverUnavailable && (
        <div className="server-offline" role="alert">
          <span className="server-offline-icon" aria-hidden>
            <IconWifi />
          </span>
          <div className="server-offline-content">
            <p className="server-offline-title">{t('serverOfflineTitle')}</p>
            <p className="server-offline-body">{t('serverOfflineBody')}</p>
            <button type="button" className="server-offline-retry" onClick={() => window.location.reload()}>
              {t('serverOfflineRetry')}
            </button>
          </div>
        </div>
      )}

      <section className="you-block">
        <p className="you-label">{t('youAre')}</p>
        {!showNameEdit ? (
          <>
            <p className="you-nick">{myName ? dn(myName) : '…'}</p>
            <button type="button" className="btn-link" onClick={() => setShowNameEdit(true)}>
              {t('changeName')}
            </button>
          </>
        ) : (
          <>
            <input
              id="my-name-input"
              className="name-input"
              defaultValue={isGeneratedNick(myName) ? '' : myName}
              maxLength={24}
              placeholder={t('namePlaceholder')}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = (e.target as HTMLInputElement).value.trim();
                  if (v) registerName(v);
                  setShowNameEdit(false);
                }
              }}
            />
            <p className="name-hint">{t('nameHint')}</p>
            <button
              type="button"
              className="btn-link"
              onClick={() => {
                const el = document.getElementById('my-name-input') as HTMLInputElement | null;
                const v = el?.value.trim();
                if (v) registerName(v);
                setShowNameEdit(false);
              }}
            >
              OK
            </button>
          </>
        )}
      </section>

      <FileDropOverlay
        copy={MESSAGES[lang]}
        active={fileDrop.active}
        ready={fileDropReady}
        hoverPeerId={fileDrop.hoverPeerId}
        peers={peers.map((p) => ({
          id: p.id,
          name: p.name,
          canReceive: canSendToPeer(p.id),
        }))}
        displayName={dn}
        getBackdropHandlers={fileDrop.getBackdropHandlers}
      />

      <section
        className={`devices-block${fileDrop.active && fileDropReady && peers.some((p) => canSendToPeer(p.id)) ? ' is-drop-zone' : ''}${fileDrop.active && peers.filter((p) => canSendToPeer(p.id)).length > 1 ? ' is-drop-zone--pick' : ''}`}
        {...(fileDrop.active && fileDropReady
          ? fileDrop.getDevicesZoneHandlers()
          : {})}
      >
        <h2 className="section-heading">{t('devicesTitle')}</h2>
        {peers.length ? (
          <div className="peers-list">
            {peers.map((p) => {
              const tp = transferProgress[p.id];
              const isTransferring = (tp?.total || 0) > 0;
              const isConnecting = connectingPeer === p.id;
              const isSending = isTransferring && tp?.mode === 'send';
              const isReceiving = isTransferring && tp?.mode === 'recv';
              const total = tp?.total || 0;
              const mode = tp?.mode || 'recv';
              const value =
                mode === 'send'
                  ? Math.min(total, tp?.sent || 0)
                  : Math.min(total, tp?.received || 0);
              const pct = total > 0 ? (value / total) * 100 : 0;
              const peerLabel = dn(p.name);
              const peerDevice = normalizeDeviceKind(p.device);
              const peerStandalone = !!p.standalone;
              const peerDeviceLabel = t(deviceLabelKey(peerDevice, peerStandalone));
              const isQueuedSend = pendingSendPeerId === p.id;
              const canPickFile =
                connected && !!myName.trim() && !isSending && !isReceiving && !isQueuedSend;
              const showConnectSpinner = isConnecting || isQueuedSend;

              const peerDrop = fileDrop.getPeerDropHandlers(p.id);

              return (
                <div
                  key={p.id}
                  className={`peer-card ${isTransferring ? 'is-busy' : ''}${
                    fileDrop.hoverPeerId === p.id ? ' is-drop-target' : ''
                  }`}
                  {...peerDrop}
                >
                  <div className="peer-card-head">
                    <span className="peer-avatar" aria-hidden>
                      <PeerAnimalIcon name={p.name} size={26} />
                    </span>
                    <div className="peer-card-info">
                      <span className="peer-name">{peerLabel.replace(/_/g, ' ')}</span>
                      <span className="peer-sublabel">{peerDeviceLabel}</span>
                    </div>
                    <span
                      className={`peer-device-icon${peerStandalone ? ' peer-device-icon--pwa' : ''}`}
                      aria-hidden
                      title={peerDeviceLabel}
                    >
                      <PeerDeviceIcon kind={peerDevice} standalone={peerStandalone} size={20} />
                    </span>
                  </div>

                  <input
                    type="file"
                    multiple
                    onChange={(e) => handleFileSelect(e, p.id)}
                    id={`file-input-${p.id}`}
                    className="hidden-file-input"
                    disabled={!canPickFile}
                  />

                  <button
                    type="button"
                    className={`btn-send btn-send-icon${isSending ? ' is-sending' : ''}${isReceiving ? ' is-receiving' : ''}`}
                    disabled={!canPickFile}
                    onClick={() => openFilePickerForPeer(p.id)}
                  >
                    {showConnectSpinner ? (
                      <>
                        <IconSpinner size={18} />
                        <span>{t('connecting')}</span>
                      </>
                    ) : (
                      <>
                        <IconUpload size={isMobile() ? 28 : 20} />
                        <span>{t('sendFileBtn')}</span>
                      </>
                    )}
                  </button>

                  {canPickFile && (
                    <PeerQuickSend
                      lang={lang}
                      disabled={!canPickFile}
                      onSendText={(text) => handleQuickSendText(p.id, text)}
                      onSendFile={(file) => handleQuickSendFile(p.id, file)}
                    />
                  )}

                  {transferInfo[p.id]?.text ? (
                    <div
                      className={`peer-transfer-msg peer-transfer-msg--${
                        transferInfo[p.id].tone === 'warn' ? 'warn' : 'info'
                      }`}
                      role="status"
                    >
                      <p>{transferInfo[p.id].text}</p>
                    </div>
                  ) : null}

                  {isTransferring && (
                    <div className="transfer-block">
                      <div className="transfer-bar-row">
                        <div className="transfer-bar">
                          <div className="transfer-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                        {mode === 'send' && (
                          <button
                            type="button"
                            className="transfer-cancel"
                            onClick={() => cancelSend(p.id)}
                            aria-label={t('cancelTransfer')}
                            title={t('cancelTransfer')}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <span className="transfer-label">
                        {mode === 'send'
                          ? (tp?.batchTotal || 0) > 1
                            ? t('transferSendingBatch', {
                                index: String(tp?.batchIndex || 1),
                                total: String(tp?.batchTotal || 1),
                              })
                            : t('transferSending')
                          : t('transferReceiving')}
                        {mode === 'send' && tp?.fileName ? (
                          <>
                            {' '}
                            <span className="transfer-file-name">{tp.fileName}</span>
                          </>
                        ) : null}{' '}
                        <strong>{formatSize(value)}</strong> / {formatSize(total)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="waiting-box">
            <span className="waiting-icon" aria-hidden>
              <IconWifi />
            </span>
            <p className="waiting-title">{t('waitingDevices')}</p>
            <p className="waiting-hint">{t('waitingHint')}</p>
          </div>
        )}
      </section>

      <section className="downloads-block" ref={downloadsRef}>
        <h2 className="section-heading">{t('receivedFiles')}</h2>
        <p className="section-desc">{t('receivedHint')}</p>
        {downloadLinks.length > 0 ? (
          <ReceivedFilesList
            lang={lang}
            links={downloadLinks}
            suspendVideoThumbs={hasActiveFileTransfer()}
            displayName={dn}
            isPreviewable={isPreviewable}
            isZipListable={isZipListable}
            zipListLabel={t('zipListBtn')}
            onSave={saveFile}
            onMarkSaved={markFilesSaved}
            onPreview={openPreview}
            onZipList={openZipList}
            onDelete={deleteItem}
            onDeleteBundle={(ids) => removeDownloadLinksByIds(ids)}
            onDeleteAll={() => setDeleteAllConfirmOpen(true)}
            deleteAllLabel={t('receivedDeleteAll')}
          />
        ) : null}
        {isStandalone || isMobile() ? (
          deviceHints.ios && !isChromeIOS() ? null : (
            <div className="app-guide app-guide--storage" aria-label={MESSAGES[lang].storagePanelLabel}>
              <div className="app-guide__card">
                <div className="app-guide__section">
                  <StorageQuotaPanel
                    lang={lang}
                    copy={MESSAGES[lang]}
                    snapshot={storageSnapshot}
                    isIos={deviceHints.ios || deviceHints.android}
                    isMobilePlatform={deviceHints.ios || deviceHints.android}
                    isChromeOnIos={deviceHints.ios && isChromeIOS()}
                    isStandalone={isStandalone}
                    sendingActive={Object.values(transferProgress).some((tp) => tp?.mode === 'send')}
                    showSharedOriginNote={!!otherClientSurface}
                  />
                </div>
              </div>
            </div>
          )
        ) : null}
      </section>

      {!(isStandalone || isMobile()) ? (
        <section className="app-guide" aria-label={lang === 'pl' ? 'Informacje' : 'Info'}>
          <div className="app-guide__card">
            <div className="app-guide__section">
              <StorageQuotaPanel
                lang={lang}
                copy={MESSAGES[lang]}
                snapshot={storageSnapshot}
                isIos={deviceHints.ios || deviceHints.android}
                isMobilePlatform={deviceHints.ios || deviceHints.android}
                isChromeOnIos={deviceHints.ios && isChromeIOS()}
                isStandalone={isStandalone}
                sendingActive={Object.values(transferProgress).some((tp) => tp?.mode === 'send')}
                showSharedOriginNote={!!otherClientSurface}
              />
            </div>
            <div className="app-guide__section app-guide__section--how">
              <p className="app-guide__heading">{t('howTitle')}</p>
              <ol className="app-guide__steps">
                <li>{t('step1')}</li>
                <li>{t('step2')}</li>
                <li>{t('step3')}</li>
              </ol>
              <p className="app-guide__note">{t('stepReceive')}</p>
            </div>
            {showPwaBar ? (
              <div className="app-guide__section app-guide__section--pwa">
                {showInstallButton ? (
                  <div className="app-guide__pwa-install">
                    <p className="app-guide__heading">{t('installDesktopHeading')}</p>
                    <p className="app-guide__pwa-install-hint">{t('installAppBtnHint')}</p>
                    <button
                      type="button"
                      className="btn-save btn-save-compact app-guide__pwa-install-btn"
                      onClick={handleInstallClick}
                    >
                      {t('installBtn')}
                    </button>
                  </div>
                ) : (
                  <p className="app-guide__pwa-hint">{t('pwaIosHint')}</p>
                )}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {quotaReceiveModal ? (
        <div
          className="quota-modal-overlay"
          role="presentation"
          onClick={() => void declineQuotaReceive(quotaReceiveModal.peerId)}
        >
          <div
            className="quota-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quota-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="quota-modal__header">
              <h2 id="quota-modal-title" className="quota-modal__title">
                {t('transferQuotaModalTitle')}
              </h2>
              <button
                type="button"
                className="icon-button close-button"
                aria-label={t('transferQuotaCancel')}
                onClick={() => void declineQuotaReceive(quotaReceiveModal.peerId)}
              >
                ✕
              </button>
            </div>
            {!quotaModalShowPurge ? (
              <>
                <p className="quota-modal__text">
                  {t('transferQuotaPrompt', {
                    needed: formatStorageDevTools(quotaReceiveModal.neededBytes, lang),
                    free: formatStorageDevTools(quotaReceiveModal.availableBytes, lang),
                  })}
                </p>
                <div className="quota-modal__file-row">
                  <span className="quota-modal__file-icon" aria-hidden>
                    <IconFile size={32} />
                  </span>
                  <span className="quota-modal__file-name">{quotaReceiveModal.fileName}</span>
                </div>
                <div className="quota-modal__actions">
                  <button
                    type="button"
                    className="btn-save"
                    onClick={() => void acceptQuotaReceive(quotaReceiveModal.peerId)}
                  >
                    {t('transferQuotaTryAnyway')}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setQuotaModalShowPurge(true)}
                    disabled={downloadLinks.length === 0}
                  >
                    {t('transferQuotaDeleteOld')}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost danger"
                    onClick={() => void declineQuotaReceive(quotaReceiveModal.peerId)}
                  >
                    {t('transferQuotaCancel')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="quota-modal__text">{t('transferQuotaPurgeHint')}</p>
                {quotaPurgeLinks.length === 0 ? (
                  <p className="quota-modal__empty">{t('transferQuotaPurgeEmpty')}</p>
                ) : (
                  <ul className="quota-modal__purge-list">
                    {quotaPurgeLinks.map((link) => (
                      <li key={link.id} className="quota-modal__purge-item">
                        <div className="quota-modal__purge-meta">
                          <span className="quota-modal__purge-name">{link.fileName}</span>
                          {link.size ? (
                            <span className="quota-modal__purge-size">
                              {formatSize(link.size)}
                            </span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="btn-ghost danger quota-modal__purge-del"
                          onClick={() => deleteItem(link.id)}
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="quota-modal__actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setQuotaModalShowPurge(false)}
                  >
                    {t('transferQuotaBack')}
                  </button>
                  {quotaPurgeLinks.length > 0 ? (
                    <button
                      type="button"
                      className="btn-ghost danger"
                      onClick={deleteAllReceivedFiles}
                    >
                      {t('transferQuotaDeleteAll')}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn-save"
                    onClick={() => void acceptQuotaReceive(quotaReceiveModal.peerId)}
                  >
                    {t('transferQuotaTryAnyway')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {deleteAllConfirmOpen ? (
        <ConfirmModal
          title={t('receivedDeleteAll')}
          message={t('receivedDeleteAllConfirm')}
          confirmLabel={t('receivedDeleteAllYes')}
          cancelLabel={t('modalCancel')}
          danger
          onConfirm={deleteAllReceivedFiles}
          onClose={() => setDeleteAllConfirmOpen(false)}
        />
      ) : null}

      {zipListModal ? (
        <ZipContentsModal
          lang={lang}
          archiveName={zipListModal.archiveName}
          entries={zipListModal.entries}
          loading={zipListModal.loading}
          error={zipListModal.error}
          onClose={() => setZipListModal(null)}
          onSave={() => {
            const item = downloadLinksRef.current.find((l) => l.id === zipListModal.linkId);
            if (item) saveFile(item);
          }}
        />
      ) : null}

      {previewItem && (
        <div className="preview-overlay" onClick={closePreview}>
          <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="preview-header">
              <div className="preview-title">
                <span>{previewItem.fileName}</span>
              </div>
              <button type="button" className="icon-button close-button" onClick={closePreview}>
                ✕
              </button>
            </div>
            <div className="preview-content">
              {isTextReadable(previewItem) ? (
                <TextFilePreview url={previewItem.url} file={previewItem.file} lang={lang} />
              ) : isAudioLink(previewItem) ? (
                <PreviewAudioPlayer
                  src={previewItem.url}
                  mime={previewItem.mime}
                  fileName={previewItem.fileName}
                />
              ) : isVideoDownloadLink(previewItem) ? (
                <PreviewVideoPlayer
                  src={previewItem.url}
                  mime={previewItem.mime}
                  fileName={previewItem.fileName}
                  fileType={previewItem.file?.type}
                  errorMessage={t('previewVideoError')}
                />
              ) : (
                <img src={previewItem.url} alt={previewItem.fileName} className="preview-media" />
              )}
            </div>
            {showBundlePreviewNav ? (
              <div className="preview-bundle-nav">
                <button
                  type="button"
                  className="btn-ghost preview-bundle-nav__btn"
                  disabled={!previewBundlePrev}
                  onClick={() => shiftBundlePreview(-1)}
                >
                  {t('previewBundlePrev')}
                </button>
                <span className="preview-bundle-nav__pos" aria-live="polite">
                  {previewItem.batchIndex}/{previewItem.batchTotal}
                </span>
                <button
                  type="button"
                  className="btn-ghost preview-bundle-nav__btn"
                  disabled={!previewBundleNext}
                  onClick={() => shiftBundlePreview(1)}
                >
                  {t('previewBundleNext')}
                </button>
              </div>
            ) : null}
            <div className="preview-actions">
              <button type="button" className="btn-save" onClick={() => savePreview(previewItem)}>
                {t('saveFile')}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="app-extras web-only">
        <div className="app-extras-actions">
          <button
            type="button"
            className="footer-link"
            onClick={() => {
              setShowLogs((open) => {
                if (!open) logsStickToBottom.current = true;
                return !open;
              });
            }}
          >
            {showLogs ? t('hideLogs') : t('showDetails')}
          </button>
        </div>
        {showLogs && (
          <div
            ref={logsPanelRef}
            className="logs-panel"
            onScroll={handleLogsScroll}
          >
            {messages.map((m, i) => (
              <div key={i} className="log-line">
                {m}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="web-only">
        <SiteFooter
          lang={lang}
          appMeta={<SiteFooterAppMeta lang={lang} version={version} shortId={shortId || undefined} />}
        />
      </div>
    </div>
  );
}
