'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { acquireSignalingSocket, releaseSignalingSocket } from '@/lib/signalingSocket';
import {
  DEFAULT_OBS_HEIGHT,
  DEFAULT_OBS_PLAYER,
  DEFAULT_OBS_WIDTH,
  fixedObsDimensions,
  parseObsPlayerSizeString,
  type ObsPlayerSize,
} from '@/lib/obsPlayerSize';
import '@/styles/obs-bare.css';

const ICE_SERVERS: RTCIceServer[] = [];

const olog = (...args: unknown[]) => {
  // eslint-disable-next-line no-console
  console.log('%c[obs]', 'color:#16a34a;font-weight:600', ...args);
};

const playWithFallback = (video: HTMLVideoElement) => {
  video.play().catch(() => {
    video.muted = true;
    video.play().catch((e) => olog('play blocked', e));
  });
};

const applyCanvasSize = (w: number, h: number, setW: (n: number) => void, setH: (n: number) => void) => {
  document.documentElement.style.setProperty('--obs-w', `${w}px`);
  document.documentElement.style.setProperty('--obs-h', `${h}px`);
  setW(w);
  setH(h);
};

type SignalPayload =
  | { type: 'offer'; sdp?: string }
  | { type: 'answer'; sdp?: string }
  | { type: 'candidate'; candidate?: RTCIceCandidateInit }
  | { type: 'flip'; value: boolean }
  | { type: 'bye' };

type Props = { token: string };

export default function ObsReceiver({ token }: Props) {
  const [hasStream, setHasStream] = useState(false);
  const [flip, setFlip] = useState(false);
  const [pin, setPin] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [pinCopied, setPinCopied] = useState(false);
  const [canvasW, setCanvasW] = useState(DEFAULT_OBS_WIDTH);
  const [canvasH, setCanvasH] = useState(DEFAULT_OBS_HEIGHT);

  const socketRef = useRef<ReturnType<typeof acquireSignalingSocket> | null>(null);
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerSizeRef = useRef<ObsPlayerSize>(DEFAULT_OBS_PLAYER);
  const urlPinRef = useRef<string | null>(null);

  const clearStream = useCallback(() => {
    if (videoRef.current) videoRef.current.srcObject = null;
    setHasStream(false);
    const ps = playerSizeRef.current;
    const { width, height } = fixedObsDimensions(ps);
    applyCanvasSize(width, height, setCanvasW, setCanvasH);
  }, []);

  const closePeerConn = useCallback(
    (peerId: string) => {
      const pc = peerConnections.current[peerId];
      if (pc) {
        pc.close();
        delete peerConnections.current[peerId];
      }
      // Brak innych aktywnych połączeń = pustka w OBS.
      if (Object.keys(peerConnections.current).length === 0) clearStream();
    },
    [clearStream],
  );

  const applyPlayerSize = useCallback((size: ObsPlayerSize) => {
    playerSizeRef.current = size;
    if (size.mode === 'fixed') {
      applyCanvasSize(size.width, size.height, setCanvasW, setCanvasH);
      olog('player fixed', size.width, size.height);
    } else {
      const { width, height } = fixedObsDimensions(DEFAULT_OBS_PLAYER);
      applyCanvasSize(width, height, setCanvasW, setCanvasH);
      olog('player auto');
    }
  }, []);

  const applyAutoFromVideo = useCallback(() => {
    if (playerSizeRef.current.mode !== 'auto' || !videoRef.current) return;
    const vw = videoRef.current.videoWidth;
    const vh = videoRef.current.videoHeight;
    if (vw > 0 && vh > 0) {
      applyCanvasSize(vw, vh, setCanvasW, setCanvasH);
      olog('player auto sized', vw, vh);
    }
  }, []);

  const copyPin = useCallback(async () => {
    if (!pin) return;
    try {
      await navigator.clipboard.writeText(pin);
      setPinCopied(true);
      window.setTimeout(() => setPinCopied(false), 1500);
    } catch {
      /* ignore */
    }
    setCtxMenu(null);
  }, [pin]);

  useEffect(() => {
    document.documentElement.classList.add('obs-bare');
    // Link jest samowystarczalny: PIN i rozmiar czytamy z hasha URL (#p=...&s=...).
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const urlPin = params.get('p');
    urlPinRef.current = urlPin;
    if (urlPin) setPin(urlPin);
    applyPlayerSize(parseObsPlayerSizeString(params.get('s')));
    return () => {
      document.documentElement.classList.remove('obs-bare');
      document.documentElement.style.removeProperty('--obs-w');
      document.documentElement.style.removeProperty('--obs-h');
    };
  }, [applyPlayerSize]);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [ctxMenu]);

  useEffect(() => {
    const signalingUrl = window.location.origin;
    const socket = acquireSignalingSocket(signalingUrl);
    socketRef.current = socket;

    const createPc = (peerId: string) => {
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
          socket.emit('signal', { to: peerId, signal: { type: 'candidate', candidate } });
        }
      };

      pc.ontrack = (ev) => {
        olog('ontrack', ev.track.kind);
        const stream = ev.streams[0] ?? new MediaStream([ev.track]);
        if (!videoRef.current) return;
        const current = videoRef.current.srcObject as MediaStream | null;
        if (current && current.id === stream.id) {
          if (!current.getTracks().some((tr) => tr.id === ev.track.id)) current.addTrack(ev.track);
        } else {
          videoRef.current.srcObject = stream;
        }
        playWithFallback(videoRef.current);
        setHasStream(true);
        if (ev.track.kind === 'video' && playerSizeRef.current.mode === 'auto') {
          const settings = ev.track.getSettings?.();
          if (settings?.width && settings?.height) {
            applyCanvasSize(settings.width, settings.height, setCanvasW, setCanvasH);
            olog('player auto from track', settings.width, settings.height);
          }
        }
        const onGone = () => {
          if (!videoRef.current?.srcObject) {
            clearStream();
            return;
          }
          const s = videoRef.current.srcObject as MediaStream;
          if (s.getVideoTracks().every((tr) => tr.readyState === 'ended')) clearStream();
        };
        // mute = klatki przestały przychodzić (nadawca zatrzymał kamerę) -> pustka od razu.
        ev.track.onmute = () => {
          olog('track mute');
          clearStream();
        };
        ev.track.onunmute = () => {
          olog('track unmute');
          if (videoRef.current?.srcObject) setHasStream(true);
        };
        ev.track.onended = onGone;
      };

      pc.oniceconnectionstatechange = () => {
        const st = pc.iceConnectionState;
        olog('ice', st);
        if (st === 'failed' || st === 'closed' || st === 'disconnected') {
          closePeerConn(peerId);
        }
      };

      return pc;
    };

    const onConnect = () => {
      olog('connected, join token', token.slice(0, 8));
      socket.emit(
        'obs_join',
        { token, pin: urlPinRef.current },
        (res: { ok?: boolean; error?: string }) => {
          olog('obs_join ack', res);
        },
      );
    };

    socket.on('connect', onConnect);
    if (socket.connected) onConnect();

    socket.on('signal', async ({ from, signal }: { from: string; signal: SignalPayload }) => {
      olog('signal in', signal.type, 'from', from);
      try {
        const pc = createPc(from);
        if (signal.type === 'offer' && signal.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('signal', { to: from, signal: { type: 'answer', sdp: answer.sdp } });
        } else if (signal.type === 'answer' && signal.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
        } else if (signal.type === 'candidate' && signal.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch {
            /* late candidate */
          }
        } else if (signal.type === 'flip') {
          setFlip(!!signal.value);
        } else if (signal.type === 'bye') {
          olog('bye from', from);
          closePeerConn(from);
        }
      } catch (e) {
        olog('signal error', e);
      }
    });

    socket.on('peer_disconnected', (peerId: string) => {
      olog('peer_disconnected', peerId);
      closePeerConn(peerId);
    });

    return () => {
      socket.off('connect', onConnect);
      socket.off('signal');
      socket.off('peer_disconnected');
      for (const id of Object.keys(peerConnections.current)) peerConnections.current[id].close();
      peerConnections.current = {};
      clearStream();
      releaseSignalingSocket();
      socketRef.current = null;
    };
  }, [applyPlayerSize, clearStream, closePeerConn, token]);

  return (
    <div className="camera-share-obs" onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }); }}>
      <video
        ref={videoRef}
        className={`camera-share-obs__video${!hasStream ? ' camera-share-obs__video--hidden' : ''}${
          flip ? ' camera-share-obs__video--flip' : ''
        }`}
        width={canvasW}
        height={canvasH}
        playsInline
        autoPlay
        onLoadedMetadata={applyAutoFromVideo}
      />
      {ctxMenu ? (
        <div
          className="camera-share-obs__ctx"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="camera-share-obs__ctx-item"
            role="menuitem"
            disabled={!pin}
            onClick={() => void copyPin()}
          >
            {pinCopied ? 'Skopiowano PIN' : 'Kopiuj PIN'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
