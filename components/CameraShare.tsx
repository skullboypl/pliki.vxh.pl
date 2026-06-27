'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import SiteFooter, { SiteFooterAppMeta } from '@/components/SiteFooter';
import { acquireSignalingSocket, releaseSignalingSocket } from '@/lib/signalingSocket';
import { APP_DISPLAY_VERSION } from '@/lib/appRelease';
import { detectDeviceKind, isStandalonePwa } from '@/lib/device';
import { displayNickname } from '@/lib/nicknames';
import {
  CAMERA_VIDEO_CONSTRAINTS,
  CAMERA_VIDEO_CONSTRAINTS_FALLBACK,
  tuneAllVideoSenders,
} from '@/lib/webrtcCameraQuality';
import { serializeObsPlayerSize, type ObsPlayerSize } from '@/lib/obsPlayerSize';
import '@/styles/camera-share.css';

const version = APP_DISPLAY_VERSION;

const ICE_SERVERS: RTCIceServer[] = [];

/** Losowy, samowystarczalny token do URL OBS (32 hex). Serwer go nie zapisuje. */
const makeObsToken = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

const makeObsPin = () => String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');

const OBS_PLAYER_SIZE: ObsPlayerSize = { mode: 'auto' };

const clog = (...args: unknown[]) => {
  // eslint-disable-next-line no-console
  console.log('%c[camera]', 'color:#16a34a;font-weight:600', ...args);
};

function IconMic({ off = false }: { off?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z"
        fill="currentColor"
      />
      <path
        d="M19 11a7 7 0 0 1-14 0M12 18v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      {off ? (
        <path d="M4 3l16 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      ) : null}
    </svg>
  );
}

type Lang = 'pl' | 'en';

type Peer = {
  id: string;
  name: string;
  shortId: string;
  device?: string;
  standalone?: boolean;
  obs?: boolean;
};

type SignalPayload =
  | { type: 'offer'; sdp?: string }
  | { type: 'answer'; sdp?: string }
  | { type: 'candidate'; candidate?: RTCIceCandidateInit }
  | { type: 'flip'; value: boolean }
  | { type: 'bye' };

const MESSAGES = {
  pl: {
    title: 'Camera share',
    subtitle: 'Podgląd kamery w LAN. Ten sam WiFi, bez chmury.',
    waiting: 'Czekam na drugie urządzenie w tej samej sieci…',
    remoteLabel: 'Obraz z urządzenia',
    localLabel: 'Twoja kamera',
    noPreview: 'Wybierz urządzenie i udostępnij strumień.',
    shareTo: 'Udostępnij',
    sharing: 'Udostępniam…',
    watching: 'Oglądam…',
    flip: 'Odbij obraz',
    mic: 'Mikrofon',
    micOn: 'Mikrofon wł.',
    stop: 'Zatrzymaj',
    peersTitle: 'Urządzenia w sieci',
    online: 'Połączono',
    offline: 'Łączenie…',
    cameraDenied: 'Brak dostępu do kamery lub mikrofonu. Zezwól w ustawieniach przeglądarki.',
    cameraError: 'Nie udało się uruchomić kamery.',
    cameraInsecure: 'Kamera wymaga HTTPS (kłódka). Otwórz stronę po https.',
    cameraNotFound: 'Nie znaleziono kamery na tym urządzeniu.',
    cameraBusy: 'Kamera jest zajęta przez inną aplikację. Zamknij ją i spróbuj ponownie.',
    micError: 'Nie udało się włączyć mikrofonu.',
    hint: 'Kliknij „Udostępnij" przy urządzeniu, na którym chcesz zobaczyć obraz. Mikrofon jest opcjonalny.',
    obsTitle: 'Link OBS',
    obsGenerate: 'Generuj link',
    obsGenerating: 'Generuję…',
    obsLinkLabel: 'URL do Browser Source',
    obsPinLabel: 'PIN (podaj przy udostępnianiu)',
    obsCopy: 'Kopiuj',
    obsCopied: 'Skopiowano',
    obsHint: 'Wklej URL w OBS jako Browser Source. OBS pojawi się na liście urządzeń. Do udostępnienia potrzebny PIN.',
    pinTitle: 'PIN do OBS',
    pinPlaceholder: '6 cyfr',
    pinSubmit: 'Udostępnij',
    pinCancel: 'Anuluj',
    badPin: 'Nieprawidłowy PIN.',
    obsBadge: 'OBS',
  },
  en: {
    title: 'Camera share',
    subtitle: 'Live camera over LAN. Same WiFi, no cloud.',
    waiting: 'Waiting for another device on the same network…',
    remoteLabel: 'Remote stream',
    localLabel: 'Your camera',
    noPreview: 'Pick a device and share a stream.',
    shareTo: 'Share',
    sharing: 'Sharing…',
    watching: 'Watching…',
    flip: 'Flip image',
    mic: 'Microphone',
    micOn: 'Mic on',
    stop: 'Stop',
    peersTitle: 'Devices on the network',
    online: 'Connected',
    offline: 'Connecting…',
    cameraDenied: 'Camera or microphone access denied. Allow it in browser settings.',
    cameraError: 'Could not start the camera.',
    cameraInsecure: 'Camera needs HTTPS (padlock). Open the page over https.',
    cameraNotFound: 'No camera found on this device.',
    cameraBusy: 'Camera is in use by another app. Close it and try again.',
    micError: 'Could not enable the microphone.',
    hint: 'Tap “Share” on the device you want to watch on. Microphone is optional.',
    obsTitle: 'OBS link',
    obsGenerate: 'Generate link',
    obsGenerating: 'Generating…',
    obsLinkLabel: 'URL for Browser Source',
    obsPinLabel: 'PIN (required when sharing)',
    obsCopy: 'Copy',
    obsCopied: 'Copied',
    obsHint: 'Paste the URL in OBS as a Browser Source. OBS will show up as a device. PIN is required to share.',
    pinTitle: 'OBS PIN',
    pinPlaceholder: '6 digits',
    pinSubmit: 'Share',
    pinCancel: 'Cancel',
    badPin: 'Invalid PIN.',
    obsBadge: 'OBS',
  },
} as const;

function detectLang(): Lang {
  if (typeof window === 'undefined') return 'pl';
  const stored = localStorage.getItem('lang');
  if (stored === 'pl' || stored === 'en') return stored;
  const nav = navigator.language || '';
  return nav.toLowerCase().startsWith('pl') ? 'pl' : 'en';
}

export default function CameraShare() {
  const [lang, setLang] = useState<Lang>(detectLang);
  const t = (key: keyof (typeof MESSAGES)['pl']) => MESSAGES[lang][key] ?? MESSAGES.pl[key];

  const [connected, setConnected] = useState(false);
  const [shortId, setShortId] = useState('');
  const [peers, setPeers] = useState<Peer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sharingPeerId, setSharingPeerId] = useState<string | null>(null);
  const [watchingPeerId, setWatchingPeerId] = useState<string | null>(null);
  const [hasLocalStream, setHasLocalStream] = useState(false);
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  const [outgoingFlip, setOutgoingFlip] = useState(false);
  const [incomingFlip, setIncomingFlip] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [micLive, setMicLive] = useState(false);
  const [obsLink, setObsLink] = useState<{ url: string; pin: string } | null>(null);
  const [obsCopied, setObsCopied] = useState<'url' | 'pin' | null>(null);
  const [pinModal, setPinModal] = useState<{ peerId: string; label: string } | null>(null);
  const [pinInput, setPinInput] = useState('');

  const socketRef = useRef<ReturnType<typeof acquireSignalingSocket> | null>(null);
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const sharingPeerIdRef = useRef<string | null>(null);
  sharingPeerIdRef.current = sharingPeerId;
  const watchingPeerIdRef = useRef<string | null>(null);
  watchingPeerIdRef.current = watchingPeerId;
  const outgoingFlipRef = useRef(false);
  outgoingFlipRef.current = outgoingFlip;
  const micEnabledRef = useRef(false);
  micEnabledRef.current = micEnabled;
  const disconnectTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    localStorage.setItem('lang', lang);
  }, [lang]);

  useEffect(() => {
    const standalone = isStandalonePwa();
    if (standalone) document.body.classList.add('is-pwa');
    else document.body.classList.remove('is-pwa');
    return () => document.body.classList.remove('is-pwa');
  }, []);

  const stopLocalStream = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((tr) => tr.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    setHasLocalStream(false);
    setMicLive(false);
  }, []);

  const closePeer = useCallback(
    (peerId: string, opts?: { notify?: boolean }) => {
      clog('closePeer', peerId);
      clearTimeout(disconnectTimers.current[peerId]);
      delete disconnectTimers.current[peerId];
      // Powiadom drugą stronę, żeby od razu wyczyściła obraz (np. pustka w OBS),
      // zamiast czekać na timeout ICE albo track.onended.
      if (opts?.notify && peerConnections.current[peerId]) {
        socketRef.current?.emit('signal', { to: peerId, signal: { type: 'bye' } });
      }
      const pc = peerConnections.current[peerId];
      if (pc) {
        pc.close();
        delete peerConnections.current[peerId];
      }
      if (sharingPeerIdRef.current === peerId) {
        stopLocalStream();
        setSharingPeerId(null);
        setOutgoingFlip(false);
      }
      if (watchingPeerIdRef.current === peerId) {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        setHasRemoteStream(false);
        setWatchingPeerId(null);
        setIncomingFlip(false);
      }
    },
    [stopLocalStream],
  );

  const closeAllPeers = useCallback(() => {
    for (const id of Object.keys(peerConnections.current)) closePeer(id, { notify: true });
    stopLocalStream();
    setSharingPeerId(null);
    setWatchingPeerId(null);
    setHasRemoteStream(false);
  }, [closePeer, stopLocalStream]);

  const attachLocalTracks = useCallback((pc: RTCPeerConnection, peerId: string) => {
    if (!localStreamRef.current) return;
    const tracks = localStreamRef.current.getTracks();
    clog('attaching local tracks', peerId, tracks.map((tr) => tr.kind));
    for (const track of tracks) {
      const exists = pc.getSenders().some((s) => s.track?.id === track.id);
      if (!exists) pc.addTrack(track, localStreamRef.current);
    }
    void tuneAllVideoSenders(pc);
  }, []);

  const createPeerConnection = useCallback(
    (peerId: string, opts?: { withLocalVideo?: boolean }) => {
      let pc = peerConnections.current[peerId];
      if (pc) return pc;

      pc = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
        iceCandidatePoolSize: 8,
        bundlePolicy: 'max-bundle',
      });
      peerConnections.current[peerId] = pc;

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          socketRef.current?.emit('signal', {
            to: peerId,
            signal: { type: 'candidate', candidate },
          });
        }
      };

      pc.ontrack = (ev) => {
        clog('ontrack from', peerId, 'kinds=', ev.track.kind);
        const stream = ev.streams[0] ?? new MediaStream([ev.track]);
        if (!remoteVideoRef.current) return;
        const current = remoteVideoRef.current.srcObject as MediaStream | null;
        if (current && current.id === stream.id) {
          if (!current.getTracks().some((tr) => tr.id === ev.track.id)) current.addTrack(ev.track);
        } else {
          remoteVideoRef.current.srcObject = stream;
        }
        void remoteVideoRef.current.play().catch(() => {});
        setHasRemoteStream(true);
        setWatchingPeerId(peerId);
        ev.track.onended = () => {
          if (!remoteVideoRef.current?.srcObject) return;
          const s = remoteVideoRef.current.srcObject as MediaStream;
          if (s.getVideoTracks().every((tr) => tr.readyState === 'ended')) closePeer(peerId);
        };
      };

      pc.oniceconnectionstatechange = () => {
        const st = pc.iceConnectionState;
        clog('iceConnectionState', peerId, st);
        if (st === 'failed' || st === 'closed') {
          closePeer(peerId);
        } else if (st === 'disconnected') {
          clearTimeout(disconnectTimers.current[peerId]);
          disconnectTimers.current[peerId] = setTimeout(() => {
            const cur = peerConnections.current[peerId];
            if (!cur) return;
            if (cur.iceConnectionState === 'disconnected' || cur.iceConnectionState === 'failed') {
              closePeer(peerId);
            }
          }, 3000);
        } else {
          clearTimeout(disconnectTimers.current[peerId]);
          delete disconnectTimers.current[peerId];
        }
      };

      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        clog('connectionState', peerId, st);
        if (st === 'connected') void tuneAllVideoSenders(pc);
        if (st === 'failed' || st === 'closed') closePeer(peerId);
      };

      if (opts?.withLocalVideo && localStreamRef.current) {
        attachLocalTracks(pc, peerId);
      }

      return pc;
    },
    [attachLocalTracks, closePeer],
  );

  const renegotiate = useCallback(async (peerId: string) => {
    const pc = peerConnections.current[peerId];
    if (!pc) return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await tuneAllVideoSenders(pc);
    clog('renegotiate offer ->', peerId);
    socketRef.current?.emit('signal', {
      to: peerId,
      signal: { type: 'offer', sdp: pc.localDescription?.sdp },
    });
  }, []);

  const startLocalCamera = useCallback(
    async (withMic: boolean) => {
      const md = navigator.mediaDevices;
      if (!md?.getUserMedia) {
        setError(window.isSecureContext ? t('cameraError') : t('cameraInsecure'));
        throw new Error('getUserMedia unavailable');
      }

      if (localStreamRef.current) {
        const hasAudio = localStreamRef.current.getAudioTracks().some((tr) => tr.readyState === 'live');
        if (withMic && !hasAudio) {
          try {
            const audioOnly = await md.getUserMedia({ audio: true, video: false });
            const audioTrack = audioOnly.getAudioTracks()[0];
            if (audioTrack) localStreamRef.current.addTrack(audioTrack);
          } catch (e) {
            clog('add mic failed', e);
            setError(t('micError'));
            throw e;
          }
        } else if (!withMic && hasAudio) {
          for (const tr of localStreamRef.current.getAudioTracks()) {
            tr.stop();
            localStreamRef.current.removeTrack(tr);
          }
        }
        setHasLocalStream(true);
        setMicLive(!!localStreamRef.current.getAudioTracks().some((tr) => tr.readyState === 'live'));
        return localStreamRef.current;
      }

      clog('startLocalCamera', { withMic, secureContext: window.isSecureContext });
      try {
        let stream: MediaStream;
        try {
          stream = await md.getUserMedia({
            video: CAMERA_VIDEO_CONSTRAINTS,
            audio: withMic,
          });
        } catch (inner) {
          if (inner instanceof DOMException && inner.name === 'OverconstrainedError') {
            try {
              stream = await md.getUserMedia({
                video: CAMERA_VIDEO_CONSTRAINTS_FALLBACK,
                audio: withMic,
              });
            } catch {
              stream = await md.getUserMedia({ video: true, audio: withMic });
            }
          } else {
            throw inner;
          }
        }
        localStreamRef.current = stream;
        setHasLocalStream(true);
        setMicLive(withMic && stream.getAudioTracks().length > 0);
        setError(null);
        clog('startLocalCamera OK', stream.getTracks().map((tr) => tr.kind));
        return stream;
      } catch (e) {
        const name = e instanceof DOMException ? e.name : '';
        clog('startLocalCamera FAILED', name, e);
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setError(t('cameraDenied'));
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setError(withMic ? t('micError') : t('cameraNotFound'));
        } else if (name === 'NotReadableError' || name === 'TrackStartError') {
          setError(t('cameraBusy'));
        } else {
          setError(`${t('cameraError')}${name ? ` (${name})` : ''}`);
        }
        throw e;
      }
    },
    [t],
  );

  const shareToPeer = useCallback(
    async (peerId: string) => {
      clog('shareToPeer', peerId, 'mic=', micEnabledRef.current);
      setError(null);
      closeAllPeers();
      try {
        await startLocalCamera(micEnabledRef.current);
        setSharingPeerId(peerId);
        const pc = createPeerConnection(peerId, { withLocalVideo: true });
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await tuneAllVideoSenders(pc);
        socketRef.current?.emit('signal', {
          to: peerId,
          signal: { type: 'offer', sdp: pc.localDescription?.sdp },
        });
        socketRef.current?.emit('signal', {
          to: peerId,
          signal: { type: 'flip', value: outgoingFlipRef.current },
        });
      } catch (e) {
        clog('shareToPeer error', peerId, e);
        closePeer(peerId);
      }
    },
    [closeAllPeers, closePeer, createPeerConnection, startLocalCamera],
  );

  const generateObsLink = useCallback(() => {
    const token = makeObsToken();
    const pin = makeObsPin();
    const size = serializeObsPlayerSize(OBS_PLAYER_SIZE);
    const url = `${window.location.origin}/camera/obs/${token}#p=${pin}&s=${size}`;
    setObsLink({ url, pin });
    setObsCopied(null);
  }, []);

  const copyObs = useCallback(async (kind: 'url' | 'pin', text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setObsCopied(kind);
      window.setTimeout(() => setObsCopied(null), 2000);
    } catch {
      /* ignore */
    }
  }, []);

  const requestShare = useCallback(
    (peer: Peer) => {
      if (peer.obs || peer.device === 'obs') {
        setPinModal({ peerId: peer.id, label: displayNickname(peer.name, lang) });
        setPinInput('');
        return;
      }
      void shareToPeer(peer.id);
    },
    [lang, shareToPeer],
  );

  const confirmPinShare = useCallback(() => {
    if (!pinModal || pinInput.trim().length < 4) return;
    const { peerId } = pinModal;
    socketRef.current?.emit(
      'obs_verify_pin',
      { to: peerId, pin: pinInput.trim() },
      (res: { ok?: boolean }) => {
        if (res?.ok) {
          setPinModal(null);
          setPinInput('');
          void shareToPeer(peerId);
        } else {
          setError(t('badPin'));
        }
      },
    );
  }, [pinInput, pinModal, shareToPeer, t]);

  const toggleFlip = useCallback(() => {
    setOutgoingFlip((prev) => {
      const next = !prev;
      const target = sharingPeerIdRef.current;
      if (target) {
        socketRef.current?.emit('signal', { to: target, signal: { type: 'flip', value: next } });
      }
      return next;
    });
  }, []);

  const toggleMic = useCallback(async () => {
    const next = !micEnabledRef.current;
    setMicEnabled(next);
    micEnabledRef.current = next;

    const peerId = sharingPeerIdRef.current;
    if (!peerId) return;

    try {
      await startLocalCamera(next);
      const pc = peerConnections.current[peerId];
      if (!pc || !localStreamRef.current) return;

      const audioTrack = localStreamRef.current.getAudioTracks().find((tr) => tr.readyState === 'live');
      const audioSender = pc.getSenders().find((s) => s.track?.kind === 'audio');

      if (next && audioTrack && !audioSender) {
        pc.addTrack(audioTrack, localStreamRef.current);
        await renegotiate(peerId);
      } else if (next && audioTrack && audioSender && audioSender.track !== audioTrack) {
        await audioSender.replaceTrack(audioTrack);
      } else if (!next && audioSender) {
        await audioSender.replaceTrack(null);
        for (const tr of localStreamRef.current.getAudioTracks()) {
          tr.stop();
          localStreamRef.current.removeTrack(tr);
        }
        setMicLive(false);
      } else if (next && audioTrack) {
        setMicLive(true);
      }
    } catch {
      setMicEnabled(!next);
      micEnabledRef.current = !next;
    }
  }, [renegotiate, startLocalCamera]);

  useEffect(() => {
    const v = localVideoRef.current;
    if (v && localStreamRef.current && v.srcObject !== localStreamRef.current) {
      v.srcObject = localStreamRef.current;
      void v.play().catch(() => {});
    }
  }, [hasLocalStream, sharingPeerId]);

  useEffect(() => {
    const signalingUrl = window.location.origin;
    const socket = acquireSignalingSocket(signalingUrl);
    socketRef.current = socket;

    const onConnect = () => {
      setConnected(true);
      socket.emit('register_device', {
        device: detectDeviceKind(),
        standalone: isStandalonePwa(),
        app: 'camera',
      });
      const stored = localStorage.getItem('myWebRTCName');
      if (stored?.trim()) socket.emit('register_name', stored);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', () => setConnected(false));
    socket.on('assigned_name', ({ shortId: sid }: { name: string; shortId: string }) => {
      if (sid) setShortId(sid);
    });
    if (socket.connected) onConnect();

    socket.on('local_peers_update', (list: Peer[]) => setPeers(list));
    socket.on('peer_disconnected', (peerId: string) => closePeer(peerId));

    socket.on('signal', async ({ from, signal }: { from: string; signal: SignalPayload }) => {
      clog('signal in', signal.type, 'from', from);
      try {
        const pc =
          peerConnections.current[from] ||
          createPeerConnection(from, {
            withLocalVideo: !!localStreamRef.current && sharingPeerIdRef.current === from,
          });

        if (signal.type === 'offer' && signal.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('signal', { to: from, signal: { type: 'answer', sdp: answer.sdp } });
          if (!localStreamRef.current) setWatchingPeerId(from);
        } else if (signal.type === 'answer' && signal.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
        } else if (signal.type === 'candidate' && signal.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch (candErr) {
            clog('addIceCandidate skipped', candErr);
          }
        } else if (signal.type === 'flip') {
          setIncomingFlip(!!signal.value);
        } else if (signal.type === 'bye') {
          clog('bye from', from);
          closePeer(from);
        }
      } catch (err) {
        console.warn('[camera] signal error', err);
      }
    });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect');
      socket.off('assigned_name');
      socket.off('local_peers_update');
      socket.off('peer_disconnected');
      socket.off('signal');
      for (const id of Object.keys(disconnectTimers.current)) {
        clearTimeout(disconnectTimers.current[id]);
      }
      disconnectTimers.current = {};
      closeAllPeers();
      releaseSignalingSocket();
      socketRef.current = null;
    };
  }, [closeAllPeers, closePeer, createPeerConnection]);

  const activePeerId = sharingPeerId || watchingPeerId;
  const showRemote = hasRemoteStream && watchingPeerId;
  const showLocal = hasLocalStream && sharingPeerId;

  return (
    <div className="app-container camera-share share-app">
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
        <span className={`status-pill ${connected ? 'on' : ''}`}>
          {connected ? t('online') : t('offline')}
        </span>
      </div>

      <header className="camera-share__header">
        <h1 className="camera-share__title">{t('title')}</h1>
        <p className="camera-share__subtitle">{t('subtitle')}</p>
      </header>

      {error ? (
        <p className="camera-share__error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="camera-share__preview-wrap">
        {showRemote ? (
          <span className="camera-share__badge">{t('remoteLabel')}</span>
        ) : showLocal ? (
          <span className="camera-share__badge">{t('localLabel')}</span>
        ) : (
          <div className="camera-share__video-placeholder">{t('noPreview')}</div>
        )}
        <video
          ref={remoteVideoRef}
          className={`camera-share__video${showRemote ? '' : ' camera-share__video--hidden'}${
            incomingFlip ? ' camera-share__video--flip' : ''
          }`}
          playsInline
          autoPlay
        />
        <video
          ref={localVideoRef}
          className={`camera-share__video${showLocal ? '' : ' camera-share__video--hidden'}${
            outgoingFlip ? ' camera-share__video--flip' : ''
          }`}
          playsInline
          autoPlay
          muted
        />
      </div>

      {!activePeerId ? (
        <button
          type="button"
          role="switch"
          aria-checked={micEnabled}
          className={`camera-share__mic-opt${micEnabled ? ' camera-share__mic-opt--on' : ''}`}
          onClick={() => {
            const next = !micEnabledRef.current;
            setMicEnabled(next);
            micEnabledRef.current = next;
          }}
        >
          <span className="camera-share__mic-icon">
            <IconMic off={!micEnabled} />
          </span>
          <span className="camera-share__mic-label">{t('mic')}</span>
          <span className="camera-share__mic-track" aria-hidden>
            <span className="camera-share__mic-knob" />
          </span>
        </button>
      ) : null}

      {activePeerId ? (
        <div className="camera-share__controls">
          {sharingPeerId ? (
            <>
              <button
                type="button"
                className={`camera-share__btn${outgoingFlip ? ' camera-share__btn--primary' : ''}`}
                onClick={toggleFlip}
                aria-pressed={outgoingFlip}
              >
                {t('flip')}
              </button>
              <button
                type="button"
                className={`camera-share__btn camera-share__btn--icon${micLive ? ' camera-share__btn--primary' : ''}`}
                onClick={() => void toggleMic()}
                aria-pressed={micLive}
              >
                <IconMic off={!micLive} />
                <span>{micLive ? t('micOn') : t('mic')}</span>
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="camera-share__btn camera-share__btn--danger"
            onClick={() => closePeer(activePeerId, { notify: true })}
          >
            {t('stop')}
          </button>
        </div>
      ) : null}

      <section className="camera-share__obs">
        <div className="camera-share__obs-head">
          <h2 className="camera-share__obs-title">{t('obsTitle')}</h2>
          <button type="button" className="camera-share__btn camera-share__btn--primary" onClick={generateObsLink}>
            {t('obsGenerate')}
          </button>
        </div>
        {obsLink ? (
          <div className="camera-share__obs-box">
            <div className="camera-share__obs-row">
              <span className="camera-share__obs-label">{t('obsLinkLabel')}</span>
              <code className="camera-share__obs-value">{obsLink.url}</code>
              <button type="button" className="camera-share__btn" onClick={() => void copyObs('url', obsLink.url)}>
                {obsCopied === 'url' ? t('obsCopied') : t('obsCopy')}
              </button>
            </div>
            <div className="camera-share__obs-row">
              <span className="camera-share__obs-label">{t('obsPinLabel')}</span>
              <code className="camera-share__obs-value camera-share__obs-pin">{obsLink.pin}</code>
              <button type="button" className="camera-share__btn" onClick={() => void copyObs('pin', obsLink.pin)}>
                {obsCopied === 'pin' ? t('obsCopied') : t('obsCopy')}
              </button>
            </div>
          </div>
        ) : null}
        <p className="camera-share__obs-hint">{t('obsHint')}</p>
      </section>

      <h2 className="camera-share__peers-title">{t('peersTitle')}</h2>

      {peers.length === 0 ? (
        <p className="camera-share__waiting">{t('waiting')}</p>
      ) : (
        peers.map((p) => {
          const isSharing = sharingPeerId === p.id;
          const isWatching = watchingPeerId === p.id;
          const busy = isSharing || isWatching;
          const label = displayNickname(p.name, lang);
          const btnLabel = isSharing ? t('sharing') : isWatching ? t('watching') : t('shareTo');
          return (
            <div key={p.id} className="camera-share__peer">
              <span
                className={`camera-share__peer-name${
                  p.obs || p.device === 'obs' ? ' camera-share__peer-name--obs' : ''
                }`}
              >
                {label}
                <span style={{ color: '#666', fontWeight: 400 }}> #{p.shortId}</span>
              </span>
              <div className="camera-share__peer-actions">
                <button
                  type="button"
                  className="camera-share__btn camera-share__btn--primary"
                  disabled={busy}
                  onClick={() => requestShare(p)}
                >
                  {btnLabel}
                </button>
              </div>
            </div>
          );
        })
      )}

      <p className="camera-share__hint">{t('hint')}</p>

      {pinModal ? (
        <div className="camera-share__pin-overlay" role="dialog" aria-modal="true" aria-labelledby="obs-pin-title">
          <div className="camera-share__pin-card">
            <h3 id="obs-pin-title" className="camera-share__pin-title">
              {t('pinTitle')} · {pinModal.label}
            </h3>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="camera-share__pin-input"
              placeholder={t('pinPlaceholder')}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmPinShare();
                if (e.key === 'Escape') setPinModal(null);
              }}
            />
            <div className="camera-share__pin-actions">
              <button type="button" className="camera-share__btn" onClick={() => setPinModal(null)}>
                {t('pinCancel')}
              </button>
              <button
                type="button"
                className="camera-share__btn camera-share__btn--primary"
                disabled={pinInput.length < 4}
                onClick={confirmPinShare}
              >
                {t('pinSubmit')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="web-only">
        <SiteFooter
          lang={lang}
          appMeta={<SiteFooterAppMeta lang={lang} version={version} shortId={shortId || undefined} />}
        />
      </div>
    </div>
  );
}
