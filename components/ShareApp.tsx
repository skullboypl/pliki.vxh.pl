'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { type Socket } from 'socket.io-client';
import { acquireSignalingSocket, releaseSignalingSocket } from '@/lib/signalingSocket';
import { displayNickname, isGeneratedNick } from '@/lib/nicknames';
import { detectDeviceKind, normalizeDeviceKind, type DeviceKind } from '@/lib/device';
import { IconSpinner, IconUpload, IconWifi } from '@/components/icons';
import PeerQuickSend from '@/components/PeerQuickSend';
import TextFilePreview from '@/components/TextFilePreview';

const PreviewVideoPlayer = dynamic(() => import('@/components/PreviewVideoPlayer'), {
  ssr: false,
  loading: () => <p className="preview-text-status">…</p>,
});
import { textToNoteFile } from '@/lib/textNote';
import ShareStrip from '@/components/ShareStrip';
import ReceivedFilesList, { type ReceivedFile } from '@/components/ReceivedFilesList';
import SiteFooter, { SiteFooterAppMeta } from '@/components/SiteFooter';
import { PeerAnimalIcon, PeerDeviceIcon } from '@/components/peer-icons';
import {
  TRANSFER_CONFIG,
  ackTimeoutForFileSize,
  quietMsForFileSize,
  sendBinaryWithRetry,
  sendBlobChunks,
  waitAllFlushed,
  waitForRecvReady,
  waitForSendComplete,
} from '@/lib/webrtcTransfer';

const ICE_SERVERS: RTCIceServer[] = [];

const isIOS = () => /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
const isAndroid = () => /android/.test(navigator.userAgent.toLowerCase());
const isChromeIOS = () => /CriOS/.test(navigator.userAgent);
const isMobile = () =>
  isIOS() ||
  isAndroid() ||
  (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches);
const hasOPFS = () => !!(navigator?.storage && navigator.storage.getDirectory);
const version = '3.1 (2026)';
const SERVER_OFFLINE_GRACE_MS = 4500;
const SERVER_OFFLINE_RECONNECT_MS = 2000;

const formatSize = (bytes: number) => {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

async function persistStorage() {
  try {
    if (navigator.storage?.persist) {
      const persisted = await navigator.storage.persist();
      return persisted;
    }
  } catch {
    /* ignore */
  }
  return false;
}

type Lang = 'pl' | 'en';
type Peer = { id: string; name: string; shortId?: string; device?: DeviceKind };
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

/** Small files: copy to RAM so `<input type="file">` can be cleared. Large files: keep picker reference (streamed via slice, no full read). */
const CLONE_IN_MEMORY_MAX_BYTES = 64 * 1024 * 1024;

const cloneSelectedFiles = async (fileList: FileList | null): Promise<File[]> => {
  const picked = Array.from(fileList ?? []).filter((f) => f.name && f.size > 0);
  if (!picked.length) return [];
  return Promise.all(
    picked.map(async (f) => {
      if (f.size > CLONE_IN_MEMORY_MAX_BYTES) return f;
      const buf = await f.arrayBuffer();
      return new File([buf], f.name, {
        type: f.type || 'application/octet-stream',
        lastModified: f.lastModified,
      });
    }),
  );
};

const clearFileInputForPeer = (peerId: string, input?: HTMLInputElement | null) => {
  const el = input ?? (document.getElementById(`file-input-${peerId}`) as HTMLInputElement | null);
  if (el) el.value = '';
};

interface DownloadLink extends ReceivedFile {}

interface TransferInfoEntry {
  text: string;
}

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

type CtrlMessage =
  | HelloMessage
  | FileMetadataMessage
  | FileEndMessage
  | FileEndAckMessage
  | FileCancelMessage
  | FileIncompleteMessage
  | FileRecvReadyMessage
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
    step3: 'Kliknij zielony przycisk i wybierz jeden lub więcej plików.',
    stepReceive: 'Na drugim urządzeniu plik pojawi się w sekcji „Odebrane pliki”.',
    youAre: 'Jesteś w sieci jako',
    changeName: 'Zmień imię',
    namePlaceholder: 'np. Tomek',
    nameHint: 'Bez wpisywania dostaniesz losowy nick.',
    devicesTitle: 'Urządzenia w sieci',
    sendFileBtn: 'Wybierz pliki i wyślij',
    sendFileTo: 'Wyślij pliki do: {name}',
    sendToDevice: 'Urządzenie w sieci',
    deviceDesktop: 'Komputer',
    deviceIphone: 'iPhone',
    deviceIpad: 'iPad',
    deviceAndroid: 'Android',
    deviceMobile: 'Telefon',
    connecting: 'Łączenie…',
    waitingDevices: 'Czekam na drugie urządzenie…',
    waitingHint: 'Wejdź na tę samą stronę na telefonie lub komputerze w tej samej WiFi.',
    receivedFiles: 'Odebrane pliki',
    receivedHint: 'Tu zobaczysz pliki wysłane do Ciebie.',
    saveFile: 'Zapisz plik',
    fromWho: 'Od: {name}',
    showDetails: 'Pokaż logi techniczne',
    hideLogs: 'Ukryj logi',
    noLogs: '—',
    online: 'Połączono',
    offline: 'Łączenie…',
    serverOffline: 'Brak połączenia',
    serverOfflineTitle: 'Nie możemy połączyć się z serwisem',
    serverOfflineBody:
      'Bez tego połączenia nie zobaczysz innych urządzeń w sieci. Sprawdź internet lub WiFi, a potem odśwież stronę.',
    serverOfflineRetry: 'Odśwież stronę',
    iosWarningBody: 'Na iPhone użyj Safari (nie Chrome).',
    understood: 'OK',
    iosInstallBody: 'Dla lepszego działania: Safari → Udostępnij → Dodaj do ekranu początkowego.',
    installBtn: 'Zainstaluj',
    pwaIosHint: 'Safari → Udostępnij → Dodaj do ekranu początkowego',
    transferSending: 'Wysyłanie pliku…',
    transferSendingBatch: 'Wysyłanie plików ({index}/{total})…',
    batchSent: 'Wysłano {count} plików',
    transferReceiving: 'Odbieranie pliku…',
    cancelTransfer: 'Anuluj wysyłanie',
    transferCancelled: 'Wysyłanie anulowane',
    transferCancelledRemote: 'Nadawca anulował transfer',
    transferRetrying: 'Uzupełnianie brakujących danych… ({pct}%)',
    transferIncomplete: 'Transfer niekompletny — spróbuj ponownie',
    fileReadError: 'Nie można odczytać pliku: {msg}',
    showBTN: 'Podgląd',
    newFile: 'Nowy plik!',
  },
  en: {
    appTitle: 'Send a file',
    appSubtitle: 'Both devices must be on the same WiFi network',
    howTitle: 'How it works',
    step1: 'Open this page on two devices (same WiFi).',
    step2: 'Pick a device from the list below.',
    step3: 'Tap the green button and choose one or more files.',
    stepReceive: 'On the other device the file appears under “Received files”.',
    youAre: 'You are on the network as',
    changeName: 'Change name',
    namePlaceholder: 'e.g. Tom',
    nameHint: 'Leave empty for a random nickname.',
    devicesTitle: 'Devices on the network',
    sendFileBtn: 'Choose files and send',
    sendFileTo: 'Send files to: {name}',
    sendToDevice: 'Device on network',
    deviceDesktop: 'Computer',
    deviceIphone: 'iPhone',
    deviceIpad: 'iPad',
    deviceAndroid: 'Android',
    deviceMobile: 'Phone',
    connecting: 'Connecting…',
    waitingDevices: 'Waiting for another device…',
    waitingHint: 'Open this page on a phone or PC on the same WiFi.',
    receivedFiles: 'Received files',
    receivedHint: 'Files sent to you will show up here.',
    saveFile: 'Save file',
    fromWho: 'From: {name}',
    showDetails: 'Show technical logs',
    hideLogs: 'Hide logs',
    noLogs: '—',
    online: 'Connected',
    offline: 'Connecting…',
    serverOffline: 'No connection',
    serverOfflineTitle: "Can't connect to the service",
    serverOfflineBody:
      "Without this connection you won't see other devices on the network. Check your internet or WiFi, then refresh the page.",
    serverOfflineRetry: 'Refresh page',
    iosWarningBody: 'On iPhone use Safari (not Chrome).',
    understood: 'OK',
    iosInstallBody: 'For best results: Safari → Share → Add to Home Screen.',
    installBtn: 'Install',
    pwaIosHint: 'Safari → Share → Add to Home Screen',
    transferSending: 'Sending file…',
    transferSendingBatch: 'Sending files ({index}/{total})…',
    batchSent: 'Sent {count} files',
    transferReceiving: 'Receiving file…',
    cancelTransfer: 'Cancel upload',
    transferCancelled: 'Upload cancelled',
    transferCancelledRemote: 'Sender cancelled the transfer',
    transferRetrying: 'Recovering missing data… ({pct}%)',
    transferIncomplete: 'Transfer incomplete — please try again',
    fileReadError: 'Could not read file: {msg}',
    showBTN: 'Preview',
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
      'ℹ️ Na iOS w Chrome OPFS nie działa — otwórz w Safari lub zainstaluj jako PWA z Safari.',
    bigRamWarning: (mb: string) =>
      `⛔ Ten plik ma ${mb} MB. Bez OPFS może zabraknąć pamięci. Polecam Safari (OPFS).`,
    sendDone: (who: string) => `✅ Wysłano plik do ${who}`,
    fileReceived: (name: string) => `📥 Pobrano plik: ${name}`,
    fileSent: (name: string) => `📤 Wysłano Plik "${name}"`,
    sendError: (who: string, msg: string) => `❗ Błąd wysyłki do ${who}: ${msg}`,
    sendResume: (offset: string, total: string, n: number) =>
      `🔄 Wznowienie wysyłki (${n}): od ${offset} B / ${total} B`,
    recvIncomplete: (got: string, expected: string, n: number) =>
      `🔄 Brakuje danych (${n}): ${got} / ${expected} B — proszę nadawcę o uzupełnienie`,
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
      'ℹ️ On iOS Chrome OPFS does not work — open in Safari or install as a PWA from Safari.',
    bigRamWarning: (mb: string) =>
      `⛔ This file is ${mb} MB. Without OPFS you may run out of memory. Use Safari (OPFS) if possible.`,
    sendDone: (who: string) => `✅ File sent to ${who}`,
    fileReceived: (name: string) => `📥 File "${name}" has been received`,
    fileSent: (name: string) => `📤 File "${name}" has been sent`,
    sendError: (who: string, msg: string) => `❗ Send error to ${who}: ${msg}`,
    sendResume: (offset: string, total: string, n: number) =>
      `🔄 Resuming send (${n}): from ${offset} B / ${total} B`,
    recvIncomplete: (got: string, expected: string, n: number) =>
      `🔄 Missing data (${n}): ${got} / ${expected} B — requesting remainder from sender`,
  },
};

const fmtMB = (bytes: number) => (bytes > 0 ? (bytes / (1024 * 1024)).toFixed(0) : '0');
const whoLabel = (peerNames: Record<string, string>, id: string, lang: Lang) =>
  displayNickname(peerNames[id] || id, lang);

const deviceLabelKey = (device: DeviceKind): MessageKey => {
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

export default function ShareApp() {
  const [lang, setLang] = useState<Lang>(detectInitialLang);
  const [socketId, setSocketId] = useState<string>('');
  const [shortId, setShortId] = useState<string>('');
  const [showIOSChromeWarning, setShowIOSChromeWarning] = useState(false);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [myName, setMyName] = useState('');
  const [connected, setConnected] = useState(false);
  const [serverUnavailable, setServerUnavailable] = useState(false);
  const [peerNames, setPeerNames] = useState<Record<string, string>>({});
  const [, setIncomingConnectionRequest] = useState<string | null>(null);
  const [transferProgress, setTransferProgress] = useState<Record<string, TransferProgressEntry>>({});
  const [transferInfo, setTransferInfo] = useState<Record<string, TransferInfoEntry>>({});
  const [localIps, setLocalIps] = useState<Set<string>>(new Set());
  const [showLogs, setShowLogs] = useState(false);
  const [connectingPeer, setConnectingPeer] = useState<string | null>(null);
  const [downloadLinks, setDownloadLinks] = useState<DownloadLink[]>([]);
  const [previewItem, setPreviewItem] = useState<DownloadLink | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deviceHints, setDeviceHints] = useState({ ios: false, android: false });
  const [showNameEdit, setShowNameEdit] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const wasConnectedRef = useRef(false);
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  const ctrlChannels = useRef<Record<string, RTCDataChannel>>({});
  const fileChannels = useRef<Record<string, RTCDataChannel>>({});
  const receivedBuffers = useRef<Record<string, ArrayBuffer[] | null>>({});
  const fileMetadata = useRef<Record<string, FileMetadata>>({});
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const opfsHandles = useRef<Record<string, FileSystemFileHandle>>({});
  const opfsWriters = useRef<Record<string, FileSystemWritableFileStream>>({});
  const opfsOffsets = useRef<Record<string, number>>({});
  const disconnectTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const chunkSizes = useRef<Record<string, number>>({});
  const netBaseline = useRef<Record<string, { in0?: number | null; out0?: number | null }>>({});
  const sendAbortFlags = useRef<Record<string, boolean>>({});
  const sendReaders = useRef<Record<string, ReadableStreamDefaultReader<Uint8Array>>>({});
  const lastFileActivity = useRef<Record<string, number>>({});
  const receivedBytes = useRef<Record<string, number>>({});
  const writeQueues = useRef<Record<string, Promise<void>>>({});
  const dbgChunks = useRef<Record<string, number>>({});
  const resumeAttempts = useRef<Record<string, number>>({});
  const activeSendFiles = useRef<Record<string, File>>({});
  const sendBatches = useRef<Record<string, SendBatch>>({});
  const pendingFileChunks = useRef<Record<string, Uint8Array[]>>({});
  const peerAgent = useRef<Record<string, PeerAgent>>({});
  const peerNamesRef = useRef(peerNames);
  const langRef = useRef(lang);
  const [pendingSendPeerId, setPendingSendPeerId] = useState<string | null>(null);
  const downloadsRef = useRef<HTMLDivElement | null>(null);
  peerNamesRef.current = peerNames;
  langRef.current = lang;

  const dn = useCallback((name: string) => displayNickname(name, lang), [lang]);

  const t = (key: MessageKey, vars: Record<string, string> = {}) => {
    const str = MESSAGES[lang][key] ?? MESSAGES.pl[key] ?? key;
    return str.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
  };

  useEffect(() => {
    persistStorage().then((ok) => {
      if (ok) log('Storage: persistent (lepsze dla dużych plików)');
    });
  }, []);

  useEffect(() => {
    if (!hasOPFS()) setShowIOSChromeWarning(true);
  }, []);

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
    startFileSend(peerId, file);
    return true;
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
    startPeerConnection(peerId);
    document.getElementById(`file-input-${peerId}`)?.click();
  };

  const clearTransferUi = (peerId: string) => {
    delete sendAbortFlags.current[peerId];
    delete sendReaders.current[peerId];
    delete activeSendFiles.current[peerId];
    setTransferProgress((p) => {
      const n = { ...p };
      delete n[peerId];
      return n;
    });
  };

  const getReceivedBytes = (peerId: string) =>
    opfsWriters.current[peerId]
      ? opfsOffsets.current[peerId] || 0
      : receivedBytes.current[peerId] || 0;

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
    delete fileMetadata.current[peerId];
    delete receivedBuffers.current[peerId];
    delete receivedBytes.current[peerId];
    delete lastFileActivity.current[peerId];
    delete writeQueues.current[peerId];
    delete opfsOffsets.current[peerId];
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
    sendReaders.current[peerId]?.cancel().catch(() => {});
    delete sendReaders.current[peerId];
    delete activeSendFiles.current[peerId];
    delete sendBatches.current[peerId];
    clearFileInputForPeer(peerId);
    setPendingSendPeerId((id) => (id === peerId ? null : id));
    const ctrl = ctrlChannels.current[peerId];
    if (ctrl?.readyState === 'open') {
      try {
        ctrl.send(JSON.stringify({ type: 'file_cancel' }));
      } catch {
        /* ignore */
      }
    }
    clearTransferUi(peerId);
    setTransferInfo((prev) => ({
      ...prev,
      [peerId]: { text: t('transferCancelled') },
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
    delete opfsHandles.current[peerId];
    delete sendAbortFlags.current[peerId];
    delete sendReaders.current[peerId];
    delete resumeAttempts.current[peerId];
    delete activeSendFiles.current[peerId];
    delete sendBatches.current[peerId];
    delete pendingFileChunks.current[peerId];
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
    const safeName = `${Date.now()}_${fileName}`;
    const handle = await root.getFileHandle(safeName, { create: true });
    if (typeof handle.createWritable !== 'function') throw new Error('createWritable not available on OPFS handle');
    const writer = await handle.createWritable();
    return { handle, writer, name: safeName };
  }

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

  async function waitQuietAfterFileEnd(peerId: string, maxMs = TRANSFER_CONFIG.QUIET_MAX_WAIT_MS) {
    const total = fileMetadata.current[peerId]?.size || 0;
    if (!total) return;

    const quietMs = quietMsForFileSize(total);
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      try {
        await writeQueues.current[peerId];
      } catch {
        /* ignore */
      }

      const written = getReceivedBytes(peerId);

      if (written >= total) {
        const idle = performance.now() - (lastFileActivity.current[peerId] || 0);
        if (idle >= quietMs) return;
      }

      await new Promise((r) => setTimeout(r, 50));
    }
    log(`WARN: timeout oczekiwania na plik (${peerId}) got=${getReceivedBytes(peerId)} / ${total}`);
  }

  const enqueueOpfsWrite = (peerId: string, u8: Uint8Array) => {
    const writer = opfsWriters.current[peerId];
    if (!writer || !u8.byteLength) return;

    const copy = u8.slice();
    const len = copy.byteLength;
    const prev = writeQueues.current[peerId] || Promise.resolve();
    writeQueues.current[peerId] = prev.then(async () => {
      const pos = opfsOffsets.current[peerId] || 0;
      await writer.write({ type: 'write', position: pos, data: copy });
      opfsOffsets.current[peerId] = pos + len;
      receivedBytes.current[peerId] = (receivedBytes.current[peerId] || 0) + len;
    }).then(() => {
      const received = receivedBytes.current[peerId] || 0;
      const total = fileMetadata.current[peerId]?.size || 0;
      if (!total) return;
      setTransferProgress((p) => ({
        ...p,
        [peerId]: { mode: 'recv', total, received, sent: 0 },
      }));
    });
  };

  const applyIncomingFileChunk = (peerId: string, u8: Uint8Array, bumpUi: () => void) => {
    if (!u8.byteLength) return;

    if (u8.byteLength === 1 && u8[0] === 0) {
      const total = fileMetadata.current[peerId]?.size || 0;
      const got = receivedBytes.current[peerId] || 0;
      if (total > 0 && got >= total) {
        lastFileActivity.current[peerId] = performance.now();
        return;
      }
    }

    lastFileActivity.current[peerId] = performance.now();

    try {
      const n = (dbgChunks.current[peerId] ?? 0) + 1;
      dbgChunks.current[peerId] = n;
      const got = receivedBytes.current[peerId] || 0;
      if (n <= 3 || (got % (5 * 1024 * 1024)) < u8.byteLength) {
        log(`FILE chunk: +${u8.byteLength}B, total=${got + u8.byteLength}B`);
      }
    } catch {
      /* ignore */
    }

    const writer = opfsWriters.current[peerId];
    if (writer) {
      enqueueOpfsWrite(peerId, u8);
    } else {
      if (!receivedBuffers.current[peerId]) receivedBuffers.current[peerId] = [];
      receivedBuffers.current[peerId]!.push(u8.slice().buffer);
      receivedBytes.current[peerId] = (receivedBytes.current[peerId] || 0) + u8.byteLength;
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
        if (meta.size && res.file.size !== meta.size) {
          log(
            `FINALIZE BŁĄD: ${meta.name} oczekiwano ${meta.size} B, zapisano ${res.file.size} B — plik niekompletny`
          );
          return;
        }
        fileName = meta.name;
        fileObj = res.file;
        url = URL.createObjectURL(res.file);
        try {
          log(`FINALIZE OPFS file.size=${res.file.size}`);
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
    };
    setDownloadLinks((prev) => [...prev, newDownloadLink]);

    setTimeout(() => {
      downloadsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    setTransferProgress((p) => ({ ...p, [peerId]: { sent: 0, received: 0, total: 0 } }));
    setTransferInfo((prev) => ({ ...prev, [peerId]: { text: L.fileReceived(fileName) } }));
    log(`FINALIZE done: link utworzony ${fileName}`);

    delete netBaseline.current[peerId];
    delete fileMetadata.current[peerId];
    delete receivedBuffers.current[peerId];
    delete opfsHandles.current[peerId];
    delete receivedBytes.current[peerId];
    delete lastFileActivity.current[peerId];
    delete writeQueues.current[peerId];
    delete opfsOffsets.current[peerId];
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
          try {
            dbgChunks.current[peerId] = 0;
          } catch {
            /* ignore */
          }
          log(`META: ${meta?.name || 'file'} size=${meta?.size || 0} mime=${meta?.type || meta?.mime || ''}`);

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

          // Zawsze próbuj OPFS (Safari/PWA/Android) — kluczowe dla dużych plików na telefonie
          if (hasOPFS()) {
            try {
              const { handle, writer } = await opfsOpenWriter(meta.name || 'file');
              opfsHandles.current[peerId] = handle;
              opfsWriters.current[peerId] = writer;
              opfsOffsets.current[peerId] = 0;
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
            } catch (e) {
              receivedBuffers.current[peerId] = [];
              const why = safeErrMsg(e);
              log(L.opfsFallback(why));
              if (isIOS() && isChromeIOS()) log(L.opfsChromeIOSNote());
              const HARD_RAM_LIMIT = isMobile() ? 128 * 1024 * 1024 : 512 * 1024 * 1024;
              if ((meta.size || 0) > HARD_RAM_LIMIT) log(L.bigRamWarning(fmtMB(meta.size || 0)));
            }
          } else {
            log('INFO: brak OPFS → bufor RAM');
            receivedBuffers.current[peerId] = [];
            if (isIOS() && isChromeIOS()) log(L.opfsChromeIOSNote());
            const HARD_RAM_LIMIT = isMobile() ? 128 * 1024 * 1024 : 512 * 1024 * 1024;
            if ((meta.size || 0) > HARD_RAM_LIMIT) log(L.bigRamWarning(fmtMB(meta.size || 0)));
          }

          const bumpRecvUi = () => {
            const received = receivedBytes.current[peerId] || 0;
            const total = fileMetadata.current[peerId]?.size || 0;
            setTransferProgress((p) => ({
              ...p,
              [peerId]: { mode: 'recv', total, received, sent: 0 },
            }));
          };

          flushPendingFileChunks(peerId, bumpRecvUi);
          signalRecvReady(peerId);
        } else if (msg.type === 'file_cancel') {
          log(`CTRL file_cancel od ${whoLabel(peerNamesRef.current, peerId, langRef.current)}`);
          await abortReceive(peerId);
          setTransferInfo((prev) => ({
            ...prev,
            [peerId]: { text: t('transferCancelledRemote') },
          }));
        } else if (msg.type === 'file_end') {
          log(`CTRL file_end od ${whoLabel(peerNamesRef.current, peerId, langRef.current)}`);
          try {
            await waitQuietAfterFileEnd(peerId);
          } catch {
            /* ignore */
          }

          const meta = fileMetadata.current[peerId];
          const expected = meta?.size || 0;
          const got = getReceivedBytes(peerId);

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
            log(`FINALIZE BŁĄD: ${meta?.name} — max prób uzupełnienia (${got}/${expected} B)`);
            setTransferInfo((prev) => ({
              ...prev,
              [peerId]: { text: t('transferIncomplete') },
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
    dc.binaryType = 'arraybuffer';
    dc.bufferedAmountLowThreshold = TRANSFER_CONFIG.BUFFERED_LOW_THRESHOLD;

    const pc = peerConnections.current[peerId];
    const sctp = pc?.sctp as (RTCSctpTransport & { maxMessageSize?: number }) | null;
    const max = sctp?.maxMessageSize || 256 * 1024;
    const SAFE_CHUNK = Math.max(16 * 1024, Math.min(32 * 1024, max - 1024));
    chunkSizes.current[peerId] = SAFE_CHUNK;

    log(L.fileChunk(whoLabel(peerNamesRef.current, peerId, langRef.current), (SAFE_CHUNK / 1024).toFixed(0)));

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
          const received = receivedBytes.current[peerId] || 0;
          const total = fileMetadata.current[peerId]?.size || 0;
          setTransferProgress((p) => ({
            ...p,
            [peerId]: {
              mode: 'recv',
              total: p[peerId]?.total || total,
              received,
              sent: 0,
            },
          }));
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
      fast.binaryType = 'arraybuffer';
      fast.bufferedAmountLowThreshold = TRANSFER_CONFIG.BUFFERED_LOW_THRESHOLD;
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
      socket.emit('register_device', detectDeviceKind());
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

  useEffect(() => {
    if (showLogs) {
      const timer = setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      return () => clearTimeout(timer);
    }
  }, [messages, showLogs]);

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
    const batchId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    sendBatches.current[peerId] = { files, index: 0, batchId };

    const fileDc = fileChannels.current[peerId];
    const ctrlDc = ctrlChannels.current[peerId];
    if (fileDc?.readyState === 'open' && ctrlDc?.readyState === 'open') {
      startFileSend(peerId, files[0]);
      return;
    }

    setPendingSendPeerId(peerId);
    setConnectingPeer(peerId);
    startPeerConnection(peerId);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, peerId: string) => {
    const input = e.target;
    let files: File[];
    try {
      files = await cloneSelectedFiles(input.files);
    } catch (err) {
      const msg = safeErrMsg(err);
      log(`⚠️ Nie można odczytać plików: ${msg}`);
      setTransferInfo((prev) => ({
        ...prev,
        [peerId]: { text: t('fileReadError', { msg }) },
      }));
      return;
    }
    if (!files.length) return;

    clearFileInputForPeer(peerId, input);
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
      setTransferInfo((prev) => ({ ...prev, [peerId]: { text: L.fileSent(file.name) } }));
      startFileSend(peerId, batch.files[batch.index]);
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
      },
    }));
    clearTransferUi(peerId);
  };

  function startFileSend(peerId: string, file: File) {
    const fileDc = fileChannels.current[peerId];
    const ctrlDc = ctrlChannels.current[peerId];
    if (!fileDc || fileDc.readyState !== 'open' || !ctrlDc || ctrlDc.readyState !== 'open') {
      return;
    }

    if (!file.size) {
      log(`⚠️ Plik „${file.name}” ma rozmiar 0 B — pomijam`);
      completeFileSend(peerId, file);
      return;
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

    fileDc.bufferedAmountLowThreshold = TRANSFER_CONFIG.BUFFERED_LOW_THRESHOLD;
    activeSendFiles.current[peerId] = file;
    resumeAttempts.current[peerId] = 0;

    finishFileSend(peerId, file)
      .then(() => completeFileSend(peerId, file))
      .catch((err) => {
        if (sendAbortFlags.current[peerId]) return;
        delete sendBatches.current[peerId];
        clearFileInputForPeer(peerId);
        log(L.sendError(whoLabel(peerNamesRef.current, peerId, langRef.current), safeErrMsg(err)));
        clearTransferUi(peerId);
      });
  }

  async function finishFileSend(peerId: string, file: File) {
    const fileDc = fileChannels.current[peerId];
    const ctrlDc = ctrlChannels.current[peerId];
    if (!fileDc || fileDc.readyState !== 'open' || !ctrlDc || ctrlDc.readyState !== 'open') {
      throw new Error('data channel not open');
    }

    const chunkSize = chunkSizes.current[peerId] || 32 * 1024;
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
    if (!recvReady) {
      log('WARN: brak file_recv_ready — wysyłam mimo to');
    }

    while (resumeRound <= TRANSFER_CONFIG.MAX_RESUME_ATTEMPTS) {
      if (sendAbortFlags.current[peerId]) throw new Error('cancelled');

      const blob = offset === 0 ? file : file.slice(offset);
      await sendBlobChunks(fileDc, blob, {
        chunkSize,
        baseOffset: offset,
        totalSize: file.size,
        abort: () => !!sendAbortFlags.current[peerId],
        onProgress: (sent) => {
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
      });
      await waitAllFlushed(fileDc, 0);
      if (sendAbortFlags.current[peerId]) throw new Error('cancelled');

      let incompleteOffset = -1;
      const result = await waitForSendComplete(
        ctrlDc,
        (got) => {
          incompleteOffset = got;
        },
        ackTimeout,
      );

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
      const nav = navigator as Navigator & { standalone?: boolean };
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        ('standalone' in nav && !!nav.standalone);
      setIsStandalone(standalone);
      if (standalone) document.body.classList.add('is-pwa');
      else document.body.classList.remove('is-pwa');
    };
    syncStandalone();
    const mq = window.matchMedia('(display-mode: standalone)');
    mq.addEventListener('change', syncStandalone);
    return () => {
      mq.removeEventListener('change', syncStandalone);
      document.body.classList.remove('is-pwa');
    };
  }, []);

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

  const isPreviewable = (link: DownloadLink) => {
    if (isTextReadable(link)) {
      const size = link.size ?? 0;
      return size <= 512 * 1024;
    }
    const mt = (link?.mime || '').toLowerCase();
    if (mt.startsWith('image/') || mt.startsWith('video/')) return true;
    const name = (link?.fileName || '').toLowerCase();
    return /\.(png|jpg|jpeg|gif|webp|bmp|svg|mp4|webm|ogg|mov|m4v)$/i.test(name);
  };

  const openPreview = (link: DownloadLink) => {
    if (isPreviewable(link)) setPreviewItem(link);
  };

  const closePreview = () => setPreviewItem(null);

  const markFilesSaved = (ids: number[]) => {
    const idSet = new Set(ids);
    setDownloadLinks((prev) => prev.map((x) => (idSet.has(x.id) ? { ...x, isNew: false } : x)));
  };

  const saveFile = (item: DownloadLink) => {
    try {
      const a = document.createElement('a');
      a.href = item.url;
      a.download = item.fileName || 'file';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      markFilesSaved([item.id]);
    } catch {
      /* ignore */
    }
  };

  const savePreview = (item: DownloadLink) => saveFile(item);

  const deleteItem = (itemId: number) => {
    setDownloadLinks((prev) => {
      const toRemove = prev.find((x) => x.id === itemId);
      if (toRemove) {
        try {
          URL.revokeObjectURL(toRemove.url);
        } catch {
          /* ignore */
        }
      }
      const next = prev.filter((x) => x.id !== itemId);
      if (previewItem && previewItem.id === itemId) setPreviewItem(null);
      return next;
    });
  };

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

      <div className="web-only">
        <ShareStrip lang={lang} />
      </div>

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

      {showIOSChromeWarning && <div className="alert alert-warn">{t('iosWarningBody')}</div>}

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

      <section className="devices-block">
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
              const isQueuedSend = pendingSendPeerId === p.id;
              const canPickFile =
                connected && !!myName.trim() && !isSending && !isReceiving && !isQueuedSend;
              const showConnectSpinner = isConnecting || isQueuedSend;

              return (
                <div key={p.id} className={`peer-card ${isTransferring ? 'is-busy' : ''}`}>
                  <div className="peer-card-head">
                    <span className="peer-avatar" aria-hidden>
                      <PeerAnimalIcon name={p.name} size={26} />
                    </span>
                    <div className="peer-card-info">
                      <span className="peer-name">{peerLabel.replace(/_/g, ' ')}</span>
                      <span className="peer-sublabel">{t(deviceLabelKey(peerDevice))}</span>
                    </div>
                    <span className="peer-device-icon" aria-hidden title={t(deviceLabelKey(peerDevice))}>
                      <PeerDeviceIcon kind={peerDevice} size={20} />
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
                        <IconUpload size={20} />
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
        <p className="section-desc web-only">{t('receivedHint')}</p>
        {downloadLinks.length > 0 ? (
          <ReceivedFilesList
            lang={lang}
            links={downloadLinks}
            displayName={dn}
            isPreviewable={isPreviewable}
            onSave={saveFile}
            onMarkSaved={markFilesSaved}
            onPreview={openPreview}
            onDelete={deleteItem}
          />
        ) : null}
      </section>

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
              ) : String(previewItem.mime || '')
                  .toLowerCase()
                  .startsWith('video/') ||
                /\.(mp4|webm|ogg|mov|m4v)$/i.test(previewItem.fileName || '') ? (
                <PreviewVideoPlayer
                  src={previewItem.url}
                  mime={previewItem.mime}
                  fileName={previewItem.fileName}
                />
              ) : (
                <img src={previewItem.url} alt={previewItem.fileName} className="preview-media" />
              )}
            </div>
            <div className="preview-actions">
              <button type="button" className="btn-save" onClick={() => savePreview(previewItem)}>
                {t('saveFile')}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="how-box how-box-bottom web-only">
        <p className="how-title">{t('howTitle')}</p>
        <ol className="how-steps">
          <li>{t('step1')}</li>
          <li>{t('step2')}</li>
          <li>{t('step3')}</li>
        </ol>
        <p className="how-note">{t('stepReceive')}</p>
      </section>

      <section className="app-extras web-only">
        {showPwaBar && (
          <div className="pwa-bar">
            {showInstallButton ? (
              <button type="button" className="pwa-install-btn" onClick={handleInstallClick}>
                {t('installBtn')}
              </button>
            ) : (
              <p className="pwa-bar-hint">{t('pwaIosHint')}</p>
            )}
          </div>
        )}
        <div className="app-extras-actions">
          <button type="button" className="footer-link" onClick={() => setShowLogs(!showLogs)}>
            {showLogs ? t('hideLogs') : t('showDetails')}
          </button>
        </div>
        {showLogs && (
          <div className="logs-panel">
            {messages.map((m, i) => (
              <div key={i} className="log-line">
                {m}
              </div>
            ))}
            <div ref={messagesEndRef} />
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
