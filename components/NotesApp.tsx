'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import SiteFooter, { SiteFooterAppMeta } from '@/components/SiteFooter';
import { acquireSignalingSocket, releaseSignalingSocket } from '@/lib/signalingSocket';
import { APP_DISPLAY_VERSION } from '@/lib/appRelease';
import { detectDeviceKind, isStandalonePwa } from '@/lib/device';
import {
  deleteNote,
  listSavedNotes,
  loadNote,
  saveNote,
  type SavedNote,
} from '@/lib/notesStorage';
import NotesStickyCard from '@/components/NotesStickyCard';
import NotesBoardImage from '@/components/NotesBoardImage';
import { imageAspect, readBlobAsImageDataUrl, readFileAsImageDataUrl } from '@/lib/notesImage';
import {
  defaultSessionName,
  emptyBoard,
  encodeNotesMessage,
  newCardId,
  newStrokeId,
  newImageId,
  normalizeBoard,
  parseNotesMessage,
  STICKY_COLORS,
  type BoardImage,
  type NotesBoard,
  type NotesWireMessage,
  type StickyCard,
  type Stroke,
  type StrokePoint,
} from '@/lib/notesProtocol';
import '@/styles/notes.css';

const version = APP_DISPLAY_VERSION;
const ICE_SERVERS: RTCIceServer[] = [];
const PEN_COLORS = ['#e8e8e8', '#6cbe45', '#5b9fd4', '#e8c547', '#e85d5d', '#c47ae8'];

type Lang = 'pl' | 'en';
type Tool = 'card' | 'draw';
type DrawMode = 'paint' | 'eraser';

type SessionRole = 'idle' | 'host' | 'guest';

type HostedSession = {
  id: string;
  sessionName: string;
  hostName: string;
  shortId: string;
};

type SignalPayload =
  | { type: 'offer'; sdp?: string }
  | { type: 'answer'; sdp?: string }
  | { type: 'candidate'; candidate?: RTCIceCandidateInit }
  | { type: 'bye' };

const MESSAGES = {
  pl: {
    title: 'Notes',
    subtitle: 'Zapisuj notatki lokalnie, hostuj sesję w LAN i dołączaj do innych.',
    savedTitle: 'Zapisane notatki',
    saveName: 'Nazwa notatki',
    save: 'Zapisz',
    load: 'Wczytaj',
    delete: 'Usuń',
    hostTitle: 'Sesja w sieci',
    hostName: 'Nazwa sesji',
    hostStart: 'Hostuj tablicę',
    hostStop: 'Zatrzymaj hosting',
    hostingAs: 'Hostujesz',
    guests: 'gości',
    sessionsTitle: 'Sesje w sieci',
    sessionsWaiting: 'Brak aktywnych sesji. Ktoś musi najpierw hostować tablicę.',
    join: 'Dołącz',
    leave: 'Odejdź',
    joinedAs: 'Dołączono do',
    hostThis: 'Hostuj',
    online: 'Połączono',
    offline: 'Łączenie…',
    toolText: 'Karteczka',
    toolDraw: 'Rysuj',
    toolPaint: 'Pędzel',
    toolEraser: 'Gumka',
    customColor: 'Kolor',
    addCard: 'Dodaj karteczkę',
    deleteCard: 'Usuń',
    resizeCard: 'Zmień rozmiar',
    cardPlaceholder: 'Pisz na karteczce…',
    fmtTitle: 'Formatowanie',
    fmtHint: 'Zaznacz tekst na karteczce',
    fmtBold: 'Pogrubienie',
    fmtItalic: 'Kursywa',
    fmtUnderline: 'Podkreślenie',
    fmtBullet: 'Lista',
    fmtTextColor: 'Kolor tekstu',
    fmtSize: 'Rozmiar',
    fullscreen: 'Pełny ekran',
    exitFullscreen: 'Wyjdź z pełnego ekranu',
    clearDraw: 'Wyczyść rysunki',
    clearAll: 'Wyczyść wszystko',
    hint: 'Hostuj tablicę albo dołącz do sesji. Karteczki, obrazy (Ctrl+V / przeciągnij) i rysunki synchronizują się przez hosta.',
    inSessionLoad: 'Odejdź z sesji, żeby wczytać inną notatkę.',
    saveOk: 'Zapisano w przeglądarce.',
    nameRequired: 'Podaj nazwę.',
  },
  en: {
    title: 'Notes',
    subtitle: 'Save notes locally, host a LAN session, and join others.',
    savedTitle: 'Saved notes',
    saveName: 'Note name',
    save: 'Save',
    load: 'Load',
    delete: 'Delete',
    hostTitle: 'Network session',
    hostName: 'Session name',
    hostStart: 'Host board',
    hostStop: 'Stop hosting',
    hostingAs: 'Hosting',
    guests: 'guests',
    sessionsTitle: 'Sessions on the network',
    sessionsWaiting: 'No active sessions. Someone must host a board first.',
    join: 'Join',
    leave: 'Leave',
    joinedAs: 'Joined',
    hostThis: 'Host',
    online: 'Connected',
    offline: 'Connecting…',
    toolText: 'Sticky note',
    toolDraw: 'Draw',
    toolPaint: 'Brush',
    toolEraser: 'Eraser',
    customColor: 'Color',
    addCard: 'Add note',
    deleteCard: 'Remove',
    resizeCard: 'Resize',
    cardPlaceholder: 'Write on the note…',
    fmtTitle: 'Formatting',
    fmtHint: 'Select text on a note',
    fmtBold: 'Bold',
    fmtItalic: 'Italic',
    fmtUnderline: 'Underline',
    fmtBullet: 'List',
    fmtTextColor: 'Text color',
    fmtSize: 'Size',
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit fullscreen',
    clearDraw: 'Clear drawings',
    clearAll: 'Clear all',
    hint: 'Host a board or join a session. Sticky notes, images (Ctrl+V / drag-drop), and drawings sync through the host.',
    inSessionLoad: 'Leave the session to load another note.',
    saveOk: 'Saved in browser.',
    nameRequired: 'Enter a name.',
  },
} as const;

function detectLang(): Lang {
  if (typeof window === 'undefined') return 'pl';
  const stored = localStorage.getItem('lang');
  if (stored === 'en' || stored === 'pl') return stored;
  return navigator.language.startsWith('pl') ? 'pl' : 'en';
}

export default function NotesApp() {
  const [lang, setLang] = useState<Lang>('pl');
  const t = useCallback((key: keyof (typeof MESSAGES)['pl']) => MESSAGES[lang][key], [lang]);

  const [connected, setConnected] = useState(false);
  const [shortId, setShortId] = useState('');
  const [role, setRole] = useState<SessionRole>('idle');
  const [hostingName, setHostingName] = useState<string | null>(null);
  const [joinedSession, setJoinedSession] = useState<HostedSession | null>(null);
  const [hostedSessions, setHostedSessions] = useState<HostedSession[]>([]);
  const [guestCount, setGuestCount] = useState(0);
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>([]);
  const [saveName, setSaveName] = useState('');
  const [hostName, setHostName] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [tool, setTool] = useState<Tool>('card');
  const [drawMode, setDrawMode] = useState<DrawMode>('paint');
  const [penColor, setPenColor] = useState(PEN_COLORS[1]);
  const [penWidth, setPenWidth] = useState(3);
  const [cardColor, setCardColor] = useState(STICKY_COLORS[0]);
  const [cards, setCards] = useState<StickyCard[]>([]);
  const [images, setImages] = useState<BoardImage[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeCardId, setActiveCardId] = useState<string>('');

  const socketRef = useRef<ReturnType<typeof acquireSignalingSocket> | null>(null);
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  const dataChannels = useRef<Record<string, RTCDataChannel>>({});
  const boardRef = useRef<NotesBoard>(emptyBoard());
  const joinedRef = useRef<Set<string>>(new Set());
  const roleRef = useRef<SessionRole>('idle');
  const hostIdRef = useRef('');
  const hostingNameRef = useRef('');
  const myIdRef = useRef<string>('');
  const remoteStrokesRef = useRef<Map<string, Stroke>>(new Map());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardWrapRef = useRef<HTMLDivElement>(null);
  const boardFsRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef<{ stroke: Stroke | null; active: boolean }>({ stroke: null, active: false });
  const dragCardRef = useRef<{ id: string; startX: number; startY: number; cardX: number; cardY: number } | null>(null);
  const activeEditorRef = useRef<HTMLDivElement | null>(null);
  const activeCardIdRef = useRef<string>('');
  const cardLiveRafRef = useRef<Record<string, number>>({});
  const progressRafRef = useRef<number | null>(null);
  const promoteToHostRef = useRef<(sessionName: string, board?: NotesBoard) => void>(() => {});
  const switchToHostRef = useRef<(hostId: string, sessionName: string) => void>(() => {});

  const applyStrokeStyle = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.mode === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
    }
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const syncCardsState = useCallback(() => {
    setCards([...boardRef.current.cards]);
    setImages([...boardRef.current.images]);
  }, []);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = boardWrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const needW = Math.max(1, Math.floor(rect.width * dpr));
    const needH = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== needW || canvas.height !== needH) {
      canvas.width = needW;
      canvas.height = needH;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const drawStroke = (stroke: Stroke) => {
      if (stroke.points.length < 2) return;
      applyStrokeStyle(ctx, stroke);
      ctx.beginPath();
      const first = stroke.points[0];
      ctx.moveTo(first.x * rect.width, first.y * rect.height);
      for (let i = 1; i < stroke.points.length; i++) {
        const p = stroke.points[i];
        ctx.lineTo(p.x * rect.width, p.y * rect.height);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    };

    for (const stroke of boardRef.current.strokes) drawStroke(stroke);
    // Kreski innych osób w trakcie rysowania (live) + nasza bieżąca.
    for (const stroke of remoteStrokesRef.current.values()) drawStroke(stroke);
    if (drawingRef.current.active && drawingRef.current.stroke) drawStroke(drawingRef.current.stroke);
  }, []);

  const publish = useCallback((msg: NotesWireMessage, exceptPeerId?: string) => {
    const currentRole = roleRef.current;
    if (currentRole === 'idle') return;
    const raw = encodeNotesMessage(msg);
    if (currentRole === 'guest') {
      const hostId = hostIdRef.current;
      const ch = dataChannels.current[hostId];
      if (ch?.readyState === 'open') ch.send(raw);
      return;
    }
    for (const [peerId, ch] of Object.entries(dataChannels.current)) {
      if (peerId === exceptPeerId) continue;
      if (ch.readyState === 'open') ch.send(raw);
    }
  }, []);

  const applyBoard = useCallback(
    (board: NotesBoard) => {
      const normalized = normalizeBoard(board);
      boardRef.current = {
        text: normalized.text,
        strokes: [...normalized.strokes],
        cards: normalized.cards.map((c) => ({ ...c })),
        images: normalized.images.map((i) => ({ ...i })),
      };
      syncCardsState();
      remoteStrokesRef.current.clear();
      redrawCanvas();
    },
    [redrawCanvas, syncCardsState],
  );

  const syncGuestCount = useCallback(() => {
    setGuestCount(joinedRef.current.size);
  }, []);

  const leavePeer = useCallback((peerId: string, opts?: { notify?: boolean }) => {
    if (opts?.notify) {
      const ch = dataChannels.current[peerId];
      if (ch?.readyState === 'open') ch.send(encodeNotesMessage({ type: 'bye' }));
    }
    const pc = peerConnections.current[peerId];
    if (pc) {
      pc.close();
      delete peerConnections.current[peerId];
    }
    delete dataChannels.current[peerId];
    joinedRef.current.delete(peerId);
    for (const key of remoteStrokesRef.current.keys()) {
      if (key.startsWith(`${peerId}:`)) remoteStrokesRef.current.delete(key);
    }
    syncGuestCount();

    if (roleRef.current === 'guest' && peerId === hostIdRef.current) {
      hostIdRef.current = '';
      window.setTimeout(() => {
        if (roleRef.current === 'guest' && !hostIdRef.current && !peerConnections.current[peerId]) {
          roleRef.current = 'idle';
          setRole('idle');
          setJoinedSession(null);
        }
      }, 6000);
      return;
    }
  }, [syncGuestCount]);

  const applyRemote = useCallback(
    (msg: NotesWireMessage, fromPeerId: string) => {
      const currentRole = roleRef.current;
      if (msg.type === 'sync') {
        const normalized = normalizeBoard(msg.board);
        boardRef.current = {
          text: normalized.text,
          strokes: [...normalized.strokes],
          cards: normalized.cards.map((c) => ({ ...c })),
          images: normalized.images.map((i) => ({ ...i })),
        };
        syncCardsState();
        remoteStrokesRef.current.clear();
        redrawCanvas();
      } else if (msg.type === 'text') {
        const normalized = normalizeBoard({ ...boardRef.current, text: msg.text });
        boardRef.current = normalized;
        syncCardsState();
        if (currentRole === 'host') publish({ type: 'text', text: msg.text }, fromPeerId);
      } else if (msg.type === 'card-live') {
        const card = boardRef.current.cards.find((c) => c.id === msg.id);
        if (card) {
          const updated = { ...card, html: msg.html, text: card.text };
          boardRef.current = {
            ...boardRef.current,
            cards: boardRef.current.cards.map((c) => (c.id === msg.id ? updated : c)),
          };
          syncCardsState();
        }
        if (currentRole === 'host') publish({ type: 'card-live', id: msg.id, html: msg.html }, fromPeerId);
      } else if (msg.type === 'stroke-progress') {
        remoteStrokesRef.current.set(`${fromPeerId}:${msg.stroke.id}`, msg.stroke);
        redrawCanvas();
        if (currentRole === 'host') publish({ type: 'stroke-progress', stroke: msg.stroke }, fromPeerId);
      } else if (msg.type === 'stroke') {
        remoteStrokesRef.current.delete(`${fromPeerId}:${msg.stroke.id}`);
        boardRef.current = { ...boardRef.current, strokes: [...boardRef.current.strokes, msg.stroke] };
        redrawCanvas();
        if (currentRole === 'host') publish({ type: 'stroke', stroke: msg.stroke }, fromPeerId);
      } else if (msg.type === 'card-add' || msg.type === 'card-update') {
        const others = boardRef.current.cards.filter((c) => c.id !== msg.card.id);
        boardRef.current = { ...boardRef.current, cards: [...others, msg.card] };
        syncCardsState();
        if (currentRole === 'host') publish(msg, fromPeerId);
      } else if (msg.type === 'card-delete') {
        boardRef.current = { ...boardRef.current, cards: boardRef.current.cards.filter((c) => c.id !== msg.id) };
        syncCardsState();
        if (currentRole === 'host') publish({ type: 'card-delete', id: msg.id }, fromPeerId);
      } else if (msg.type === 'image-add' || msg.type === 'image-update') {
        const others = boardRef.current.images.filter((i) => i.id !== msg.image.id);
        boardRef.current = { ...boardRef.current, images: [...others, msg.image] };
        syncCardsState();
        if (currentRole === 'host') publish(msg, fromPeerId);
      } else if (msg.type === 'image-delete') {
        boardRef.current = { ...boardRef.current, images: boardRef.current.images.filter((i) => i.id !== msg.id) };
        syncCardsState();
        if (currentRole === 'host') publish({ type: 'image-delete', id: msg.id }, fromPeerId);
      } else if (msg.type === 'host-migrate') {
        if (msg.successorId === myIdRef.current) {
          promoteToHostRef.current(msg.sessionName, msg.board);
        } else if (roleRef.current === 'guest') {
          switchToHostRef.current(msg.successorId, msg.sessionName);
        }
      } else if (msg.type === 'clear') {
        boardRef.current = { ...boardRef.current, strokes: [] };
        remoteStrokesRef.current.clear();
        redrawCanvas();
        if (currentRole === 'host') publish({ type: 'clear' }, fromPeerId);
      } else if (msg.type === 'bye') {
        leavePeer(fromPeerId);
      }
    },
    [leavePeer, publish, redrawCanvas, syncCardsState],
  );

  const attachChannel = useCallback(
    (peerId: string, channel: RTCDataChannel) => {
      dataChannels.current[peerId] = channel;
      channel.onopen = () => {
        if (roleRef.current === 'host') {
          channel.send(encodeNotesMessage({ type: 'sync', board: normalizeBoard(boardRef.current) }));
        } else if (roleRef.current === 'guest' && hostIdRef.current) {
          socketRef.current?.emit('notes_session_register', { hostId: hostIdRef.current });
        }
        syncGuestCount();
      };
      channel.onmessage = (ev) => {
        const msg = parseNotesMessage(String(ev.data));
        if (msg) applyRemote(msg, peerId);
      };
      channel.onclose = () => {
        delete dataChannels.current[peerId];
        syncGuestCount();
      };
    },
    [applyRemote, syncGuestCount],
  );

  const closeAllPeers = useCallback(() => {
    for (const id of Object.keys(peerConnections.current)) {
      const ch = dataChannels.current[id];
      if (ch?.readyState === 'open') ch.send(encodeNotesMessage({ type: 'bye' }));
      leavePeer(id);
    }
  }, [leavePeer]);

  const createPeerConnection = useCallback(
    (peerId: string, initiator: boolean) => {
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

      pc.oniceconnectionstatechange = () => {
        const st = pc.iceConnectionState;
        if (st === 'failed' || st === 'closed' || st === 'disconnected') leavePeer(peerId);
      };

      pc.ondatachannel = ({ channel }) => {
        if (channel.label === 'notes') attachChannel(peerId, channel);
      };

      if (initiator) {
        const ch = pc.createDataChannel('notes', { ordered: true });
        attachChannel(peerId, ch);
      }

      return pc;
    },
    [attachChannel, leavePeer],
  );

  const connectToHost = useCallback(
    async (peerId: string) => {
      if (joinedRef.current.has(peerId) || peerConnections.current[peerId]) return;
      joinedRef.current.add(peerId);
      syncGuestCount();
      try {
        const pc = createPeerConnection(peerId, true);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current?.emit('signal', {
          to: peerId,
          signal: { type: 'offer', sdp: pc.localDescription?.sdp },
        });
      } catch {
        leavePeer(peerId);
      }
    },
    [createPeerConnection, leavePeer, syncGuestCount],
  );

  const startHosting = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed || roleRef.current !== 'idle') return;
      closeAllPeers();
      roleRef.current = 'host';
      hostingNameRef.current = trimmed;
      setRole('host');
      setHostingName(trimmed);
      setHostName(trimmed);
      socketRef.current?.emit('notes_host', { name: trimmed });
    },
    [closeAllPeers],
  );

  const promoteToHost = useCallback(
    (sessionName: string, board?: NotesBoard) => {
      closeAllPeers();
      if (board) applyBoard(board);
      roleRef.current = 'host';
      hostingNameRef.current = sessionName;
      setRole('host');
      setHostingName(sessionName);
      setHostName(sessionName);
      setJoinedSession(null);
      socketRef.current?.emit('notes_host', { name: sessionName });
    },
    [applyBoard, closeAllPeers],
  );
  promoteToHostRef.current = promoteToHost;

  const switchToHost = useCallback(
    async (newHostId: string, sessionName: string) => {
      if (!newHostId || newHostId === myIdRef.current) return;
      if (hostIdRef.current === newHostId && peerConnections.current[newHostId]) return;
      const oldHost = hostIdRef.current;
      if (oldHost && oldHost !== newHostId) leavePeer(oldHost);
      hostIdRef.current = newHostId;
      roleRef.current = 'guest';
      setRole('guest');
      setJoinedSession({
        id: newHostId,
        sessionName,
        hostName: '',
        shortId: newHostId.slice(-4).toUpperCase(),
      });
      await connectToHost(newHostId);
    },
    [connectToHost, leavePeer],
  );
  switchToHostRef.current = switchToHost;

  const stopHosting = useCallback(() => {
    if (roleRef.current !== 'host') return;
    const guests = Array.from(joinedRef.current).sort();
    const sessionName = hostingNameRef.current;
    if (guests.length > 0 && sessionName) {
      const successor = guests[0];
      const board = normalizeBoard(boardRef.current);
      const raw = encodeNotesMessage({
        type: 'host-migrate',
        successorId: successor,
        sessionName,
        board,
      });
      for (const ch of Object.values(dataChannels.current)) {
        if (ch.readyState === 'open') ch.send(raw);
      }
      socketRef.current?.emit('notes_handoff', { successorId: successor, sessionName });
    } else {
      socketRef.current?.emit('notes_stop_host');
    }
    closeAllPeers();
    roleRef.current = 'idle';
    hostingNameRef.current = '';
    setRole('idle');
    setHostingName(null);
    setHostName(defaultSessionName(lang));
  }, [closeAllPeers, lang]);

  const joinSession = useCallback(
    async (session: HostedSession) => {
      if (roleRef.current !== 'idle') return;
      roleRef.current = 'guest';
      hostIdRef.current = session.id;
      setRole('guest');
      setJoinedSession(session);
      await connectToHost(session.id);
    },
    [connectToHost],
  );

  const leaveSession = useCallback(() => {
    if (roleRef.current !== 'guest') return;
    const hostId = hostIdRef.current;
    if (hostId) leavePeer(hostId, { notify: true });
    roleRef.current = 'idle';
    hostIdRef.current = '';
    setRole('idle');
    setJoinedSession(null);
  }, [leavePeer]);

  const addCardAt = useCallback(
    (x: number, y: number) => {
      const card: StickyCard = {
        id: newCardId(),
        x: Math.min(0.78, Math.max(0, x - 0.11)),
        y: Math.min(0.82, Math.max(0, y - 0.09)),
        w: 0.22,
        h: 0.2,
        text: '',
        html: '',
        color: cardColor,
      };
      boardRef.current = { ...boardRef.current, cards: [...boardRef.current.cards, card] };
      syncCardsState();
      publish({ type: 'card-add', card });
    },
    [cardColor, publish, syncCardsState],
  );

  const deleteCard = useCallback(
    (id: string) => {
      boardRef.current = { ...boardRef.current, cards: boardRef.current.cards.filter((c) => c.id !== id) };
      syncCardsState();
      publish({ type: 'card-delete', id });
    },
    [publish, syncCardsState],
  );

  const onCardHtmlChange = useCallback(
    (id: string, html: string, live: boolean) => {
      const card = boardRef.current.cards.find((c) => c.id === id);
      if (!card) return;
      const updated = { ...card, html, text: card.text };
      boardRef.current = {
        ...boardRef.current,
        cards: boardRef.current.cards.map((c) => (c.id === id ? updated : c)),
      };
      syncCardsState();
      if (live) {
        const prev = cardLiveRafRef.current[id];
        if (prev) cancelAnimationFrame(prev);
        cardLiveRafRef.current[id] = requestAnimationFrame(() => {
          delete cardLiveRafRef.current[id];
          publish({ type: 'card-live', id, html });
        });
      } else {
        publish({ type: 'card-update', card: updated });
      }
    },
    [publish, syncCardsState],
  );

  const activateCard = useCallback((id: string, el: HTMLDivElement | null) => {
    activeEditorRef.current = el;
    activeCardIdRef.current = id;
    setActiveCardId(id);
  }, []);

  const resizeCard = useCallback(
    (card: StickyCard, final: boolean) => {
      boardRef.current = {
        ...boardRef.current,
        cards: boardRef.current.cards.map((c) => (c.id === card.id ? card : c)),
      };
      syncCardsState();
      if (final) publish({ type: 'card-update', card });
    },
    [publish, syncCardsState],
  );

  const runFormat = useCallback(
    (cmd: string, value?: string) => {
      const el = activeEditorRef.current;
      const id = activeCardIdRef.current;
      if (!el || !id) return;
      el.focus();
      document.execCommand(cmd, false, value);
      onCardHtmlChange(id, el.innerHTML, false);
    },
    [onCardHtmlChange],
  );

  const applyFontSize = useCallback(
    (px: number) => {
      const el = activeEditorRef.current;
      const id = activeCardIdRef.current;
      if (!el || !id) return;
      el.focus();
      const sel = window.getSelection();
      if (sel && sel.rangeCount && !sel.isCollapsed) {
        const span = document.createElement('span');
        span.style.fontSize = `${px}px`;
        try {
          sel.getRangeAt(0).surroundContents(span);
        } catch {
          document.execCommand('insertHTML', false, `<span style="font-size:${px}px">${sel.toString()}</span>`);
        }
      } else {
        // Brak zaznaczenia: ustaw rozmiar dla całej karteczki.
        el.style.fontSize = `${px}px`;
      }
      onCardHtmlChange(id, el.innerHTML, false);
    },
    [onCardHtmlChange],
  );

  const applyTextColor = useCallback(
    (color: string) => {
      runFormat('foreColor', color);
    },
    [runFormat],
  );

  const addImageFromDataUrl = useCallback(
    async (src: string, x = 0.3, y = 0.25) => {
      const ar = await imageAspect(src);
      const w = 0.28;
      const h = w / ar;
      const image: BoardImage = {
        id: newImageId(),
        x: Math.min(0.7, Math.max(0, x - w / 2)),
        y: Math.min(0.75, Math.max(0, y - h / 2)),
        w,
        h,
        src,
        cropX: 0,
        cropY: 0,
        cropW: 1,
        cropH: 1,
      };
      boardRef.current = { ...boardRef.current, images: [...boardRef.current.images, image] };
      syncCardsState();
      publish({ type: 'image-add', image });
    },
    [publish, syncCardsState],
  );

  const updateImage = useCallback(
    (image: BoardImage, final: boolean) => {
      boardRef.current = {
        ...boardRef.current,
        images: boardRef.current.images.map((i) => (i.id === image.id ? image : i)),
      };
      syncCardsState();
      if (final) publish({ type: 'image-update', image });
    },
    [publish, syncCardsState],
  );

  const deleteImage = useCallback(
    (id: string) => {
      boardRef.current = { ...boardRef.current, images: boardRef.current.images.filter((i) => i.id !== id) };
      syncCardsState();
      publish({ type: 'image-delete', id });
    },
    [publish, syncCardsState],
  );

  const importImagesFromFiles = useCallback(
    async (files: FileList | File[]) => {
      for (const file of files) {
        const src = await readFileAsImageDataUrl(file);
        if (src) await addImageFromDataUrl(src);
      }
    },
    [addImageFromDataUrl],
  );

  const onBoardPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (tool !== 'card' || dragCardRef.current) return;
    if ((e.target as HTMLElement).closest('.notes-app__card')) return;
    const wrap = boardWrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    addCardAt((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
  };

  const onCardHeadPointerDown = (e: React.PointerEvent<HTMLDivElement>, card: StickyCard) => {
    if (tool !== 'card') return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragCardRef.current = { id: card.id, startX: e.clientX, startY: e.clientY, cardX: card.x, cardY: card.y };
  };

  const onCardHeadPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragCardRef.current;
    if (!drag) return;
    const wrap = boardWrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const card = boardRef.current.cards.find((c) => c.id === drag.id);
    if (!card) return;
    const nx = Math.min(0.78, Math.max(0, drag.cardX + (e.clientX - drag.startX) / rect.width));
    const ny = Math.min(0.82, Math.max(0, drag.cardY + (e.clientY - drag.startY) / rect.height));
    const updated = { ...card, x: nx, y: ny };
    const others = boardRef.current.cards.filter((c) => c.id !== drag.id);
    boardRef.current = { ...boardRef.current, cards: [...others, updated] };
    syncCardsState();
  };

  const onCardHeadPointerUp = () => {
    const drag = dragCardRef.current;
    if (!drag) return;
    dragCardRef.current = null;
    const card = boardRef.current.cards.find((c) => c.id === drag.id);
    if (card) publish({ type: 'card-update', card });
  };

  const toggleFullscreen = useCallback(() => {
    const el = boardFsRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen();
  }, []);

  const clearDrawings = useCallback(() => {
    boardRef.current = { ...boardRef.current, strokes: [] };
    redrawCanvas();
    publish({ type: 'clear' });
  }, [publish, redrawCanvas]);

  const clearAll = useCallback(() => {
    boardRef.current = emptyBoard();
    syncCardsState();
    redrawCanvas();
    publish({ type: 'sync', board: boardRef.current });
  }, [publish, redrawCanvas, syncCardsState]);

  const handleSave = useCallback(() => {
    const name = saveName.trim();
    if (!name) {
      setStatusMsg(t('nameRequired'));
      return;
    }
    const saved = saveNote(name, boardRef.current);
    if (!saved) return;
    setSavedNotes(listSavedNotes());
    setStatusMsg(t('saveOk'));
  }, [saveName, t]);

  const handleLoad = useCallback(
    (name: string) => {
      if (roleRef.current !== 'idle') {
        setStatusMsg(t('inSessionLoad'));
        return;
      }
      const note = loadNote(name);
      if (!note) return;
      applyBoard(note.board);
      setSaveName(name);
      setHostName(name);
      setStatusMsg('');
    },
    [applyBoard, t],
  );

  const handleDelete = useCallback((name: string) => {
    if (deleteNote(name)) setSavedNotes(listSavedNotes());
  }, []);

  const handleHostSaved = useCallback(
    (name: string) => {
      if (roleRef.current !== 'idle') return;
      const note = loadNote(name);
      if (note) applyBoard(note.board);
      startHosting(name);
    },
    [applyBoard, startHosting],
  );

  const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>): StrokePoint | null => {
    const wrap = boardWrapRef.current;
    if (!wrap) return null;
    const rect = wrap.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool !== 'draw') return;
    const p = pointerPos(e);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = {
      active: true,
      stroke: {
        id: newStrokeId(),
        color: drawMode === 'eraser' ? '#000000' : penColor,
        width: drawMode === 'eraser' ? Math.max(penWidth, 10) : penWidth,
        points: [p],
        mode: drawMode,
      },
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current.active || !drawingRef.current.stroke) return;
    const p = pointerPos(e);
    if (!p) return;
    const stroke = drawingRef.current.stroke;
    stroke.points.push(p);

    // Rysuj tylko nowy odcinek na istniejącym canvasie (bez kosztownego pełnego redraw).
    const canvas = canvasRef.current;
    const wrap = boardWrapRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && wrap && stroke.points.length >= 2) {
      const rect = wrap.getBoundingClientRect();
      applyStrokeStyle(ctx, stroke);
      ctx.beginPath();
      const a = stroke.points[stroke.points.length - 2];
      const b = stroke.points[stroke.points.length - 1];
      ctx.moveTo(a.x * rect.width, a.y * rect.height);
      ctx.lineTo(b.x * rect.width, b.y * rect.height);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }

    // Live podgląd u innych — wysyłka throttlowana przez rAF.
    if (progressRafRef.current == null) {
      progressRafRef.current = requestAnimationFrame(() => {
        progressRafRef.current = null;
        if (drawingRef.current.active && drawingRef.current.stroke) {
          publish({ type: 'stroke-progress', stroke: drawingRef.current.stroke });
        }
      });
    }
  };

  const onPointerUp = () => {
    if (progressRafRef.current != null) {
      cancelAnimationFrame(progressRafRef.current);
      progressRafRef.current = null;
    }
    if (!drawingRef.current.active || !drawingRef.current.stroke) return;
    const stroke = drawingRef.current.stroke;
    drawingRef.current = { active: false, stroke: null };
    if (stroke.points.length < 2) return;
    boardRef.current = { ...boardRef.current, strokes: [...boardRef.current.strokes, stroke] };
    publish({ type: 'stroke', stroke });
  };

  useEffect(() => {
    setLang(detectLang());
  }, []);

  useEffect(() => {
    setHostName((prev) => prev || defaultSessionName(lang));
  }, [lang]);

  useEffect(() => {
    setSavedNotes(listSavedNotes());
  }, []);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    localStorage.setItem('lang', lang);
  }, [lang]);

  useEffect(() => {
    const standalone = isStandalonePwa();
    if (standalone) document.body.classList.add('is-pwa');
    else document.body.classList.remove('is-pwa');
    return () => document.body.classList.remove('is-pwa');
  }, []);

  useEffect(() => {
    const el = boardWrapRef.current;
    if (!el) return;

    const onPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) continue;
          const src = await readBlobAsImageDataUrl(blob);
          if (src) void addImageFromDataUrl(src);
          break;
        }
      }
    };

    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (!files?.length) return;
      const wrap = boardWrapRef.current;
      let x = 0.3;
      let y = 0.25;
      if (wrap && e.clientX) {
        const rect = wrap.getBoundingClientRect();
        x = (e.clientX - rect.left) / rect.width;
        y = (e.clientY - rect.top) / rect.height;
      }
      for (const file of files) {
        const src = await readFileAsImageDataUrl(file);
        if (src) await addImageFromDataUrl(src, x, y);
      }
    };

    const onDragOver = (e: DragEvent) => e.preventDefault();

    el.addEventListener('paste', onPaste);
    el.addEventListener('drop', onDrop);
    el.addEventListener('dragover', onDragOver);
    return () => {
      el.removeEventListener('paste', onPaste);
      el.removeEventListener('drop', onDrop);
      el.removeEventListener('dragover', onDragOver);
    };
  }, [addImageFromDataUrl]);

  useEffect(() => {
    const ro = new ResizeObserver(() => redrawCanvas());
    if (boardWrapRef.current) ro.observe(boardWrapRef.current);
    return () => ro.disconnect();
  }, [redrawCanvas]);

  useEffect(() => {
    const socket = acquireSignalingSocket(window.location.origin);
    socketRef.current = socket;

    const onConnect = () => {
      setConnected(true);
      myIdRef.current = socket.id ?? '';
      socket.emit('register_device', {
        device: detectDeviceKind(),
        standalone: isStandalonePwa(),
        app: 'notes',
      });
      const stored = localStorage.getItem('myWebRTCName');
      if (stored?.trim()) socket.emit('register_name', stored);
      if (hostingNameRef.current) {
        socket.emit('notes_host', { name: hostingNameRef.current });
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', () => setConnected(false));
    socket.on('assigned_name', ({ shortId: sid }: { shortId: string }) => {
      if (sid) setShortId(sid);
    });
    socket.on('notes_hosts_update', (list: HostedSession[]) => setHostedSessions(list));
    socket.on('notes_promoted_host', ({ sessionName, guestIds }: { sessionName: string; guestIds: string[] }) => {
      promoteToHostRef.current(sessionName);
      for (const gid of guestIds) {
        joinedRef.current.add(gid);
      }
      syncGuestCount();
    });
    socket.on('notes_host_changed', ({ newHostId, sessionName }: { newHostId: string; sessionName: string }) => {
      void switchToHostRef.current(newHostId, sessionName);
    });
    socket.on('peer_disconnected', (peerId: string) => leavePeer(peerId));

    socket.on('signal', async ({ from, signal }: { from: string; signal: SignalPayload }) => {
      try {
        if (signal.type === 'offer' && signal.sdp) {
          if (roleRef.current !== 'host') return;
          const pc = createPeerConnection(from, false);
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          joinedRef.current.add(from);
          syncGuestCount();
          socket.emit('signal', { to: from, signal: { type: 'answer', sdp: answer.sdp } });
        } else if (signal.type === 'answer' && signal.sdp) {
          const pc = peerConnections.current[from];
          if (pc) await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
        } else if (signal.type === 'candidate' && signal.candidate) {
          const pc = peerConnections.current[from];
          if (pc) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } catch {
              /* late */
            }
          }
        } else if (signal.type === 'bye') {
          leavePeer(from);
        }
      } catch {
        leavePeer(from);
      }
    });

    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect');
      socket.off('assigned_name');
      socket.off('notes_hosts_update');
      socket.off('notes_promoted_host');
      socket.off('notes_host_changed');
      socket.off('peer_disconnected');
      socket.off('signal');
      if (roleRef.current === 'host') {
        const guests = Array.from(joinedRef.current).sort();
        if (guests.length > 0 && hostingNameRef.current) {
          socket.emit('notes_handoff', { successorId: guests[0], sessionName: hostingNameRef.current });
        } else {
          socket.emit('notes_stop_host');
        }
      }
      closeAllPeers();
      releaseSignalingSocket();
      socketRef.current = null;
    };
  }, [closeAllPeers, createPeerConnection, leavePeer, syncGuestCount]);

  return (
    <div className="app-container notes-app share-app">
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
        <span className={`status-pill ${connected ? 'on' : ''}`}>{connected ? t('online') : t('offline')}</span>
      </div>

      <header className="notes-app__header">
        <h1 className="notes-app__title">{t('title')}</h1>
        <p className="notes-app__subtitle">{t('subtitle')}</p>
      </header>

      <section className="notes-app__panel" aria-label={t('savedTitle')}>
        <h2 className="notes-app__panel-title">{t('savedTitle')}</h2>
        <div className="notes-app__row">
          <input
            className="notes-app__input"
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder={t('saveName')}
            maxLength={64}
            disabled={role !== 'idle'}
          />
          <button type="button" className="notes-app__tool-btn" onClick={handleSave} disabled={role !== 'idle'}>
            {t('save')}
          </button>
        </div>
        {statusMsg ? <p className="notes-app__status">{statusMsg}</p> : null}
        {savedNotes.length === 0 ? (
          <p className="notes-app__muted">{lang === 'pl' ? 'Brak zapisanych notatek.' : 'No saved notes yet.'}</p>
        ) : (
          <ul className="notes-app__saved">
            {savedNotes.map((note) => (
              <li key={note.name} className="notes-app__saved-item">
                <span className="notes-app__saved-name">{note.name}</span>
                <div className="notes-app__saved-actions">
                  <button type="button" className="notes-app__tool-btn" onClick={() => handleLoad(note.name)} disabled={role !== 'idle'}>
                    {t('load')}
                  </button>
                  <button type="button" className="notes-app__tool-btn" onClick={() => handleHostSaved(note.name)} disabled={role !== 'idle'}>
                    {t('hostThis')}
                  </button>
                  <button
                    type="button"
                    className="notes-app__tool-btn notes-app__tool-btn--danger"
                    onClick={() => handleDelete(note.name)}
                    disabled={role !== 'idle'}
                  >
                    {t('delete')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="notes-app__panel" aria-label={t('hostTitle')}>
        <h2 className="notes-app__panel-title">{t('hostTitle')}</h2>
        {role === 'host' ? (
          <div className="notes-app__session-active">
            <p>
              {t('hostingAs')}: <strong>{hostingName}</strong>
              {guestCount > 0 ? ` · ${guestCount} ${t('guests')}` : ''}
            </p>
            <button type="button" className="notes-app__tool-btn notes-app__tool-btn--danger" onClick={stopHosting}>
              {t('hostStop')}
            </button>
          </div>
        ) : role === 'guest' && joinedSession ? (
          <div className="notes-app__session-active">
            <p>
              {t('joinedAs')}: <strong>{joinedSession.sessionName}</strong> ({joinedSession.hostName} #{joinedSession.shortId})
            </p>
            <button type="button" className="notes-app__tool-btn" onClick={leaveSession}>
              {t('leave')}
            </button>
          </div>
        ) : (
          <div className="notes-app__row">
            <input
              className="notes-app__input"
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder={t('hostName')}
              maxLength={64}
            />
            <button
              type="button"
              className="notes-app__tool-btn notes-app__tool-btn--accent"
              onClick={() => startHosting(hostName)}
              disabled={!hostName.trim()}
            >
              {t('hostStart')}
            </button>
          </div>
        )}
      </section>

      {role === 'idle' ? (
        <section className="notes-app__panel" aria-label={t('sessionsTitle')}>
          <h2 className="notes-app__panel-title">{t('sessionsTitle')}</h2>
          {hostedSessions.length === 0 ? (
            <p className="notes-app__waiting">{t('sessionsWaiting')}</p>
          ) : (
            <ul className="notes-app__peers">
              {hostedSessions.map((session) => (
                <li key={session.id} className="notes-app__peer">
                  <span className="notes-app__peer-name">
                    {session.sessionName}
                    <span className="notes-app__peer-id">
                      {session.hostName} #{session.shortId}
                    </span>
                  </span>
                  <button type="button" className="notes-app__peer-btn" onClick={() => void joinSession(session)}>
                    {t('join')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <div ref={boardFsRef} className={`notes-app__board-fs${isFullscreen ? ' notes-app__board-fs--on' : ''}`}>
      <div className="notes-app__toolbar" role="toolbar" aria-label={lang === 'pl' ? 'Narzędzia' : 'Tools'}>
        <div className="notes-app__tool-modes">
          <button
            type="button"
            className={`notes-app__tool-btn${tool === 'card' ? ' notes-app__tool-btn--on' : ''}`}
            onClick={() => setTool('card')}
          >
            {t('toolText')}
          </button>
          <button
            type="button"
            className={`notes-app__tool-btn${tool === 'draw' ? ' notes-app__tool-btn--on' : ''}`}
            onClick={() => setTool('draw')}
          >
            {t('toolDraw')}
          </button>
        </div>
        {tool === 'card' ? (
          <>
            <div className="notes-app__colors" role="group" aria-label={lang === 'pl' ? 'Kolor karteczki' : 'Note color'}>
              {STICKY_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`notes-app__swatch${cardColor === c ? ' notes-app__swatch--on' : ''}`}
                  style={{ background: c }}
                  aria-label={c}
                  onClick={() => setCardColor(c)}
                />
              ))}
            </div>
            <button type="button" className="notes-app__tool-btn" onClick={() => addCardAt(0.38, 0.36)}>
              {t('addCard')}
            </button>
          </>
        ) : null}
        {tool === 'draw' ? (
          <>
            <div className="notes-app__tool-modes">
              <button
                type="button"
                className={`notes-app__tool-btn${drawMode === 'paint' ? ' notes-app__tool-btn--on' : ''}`}
                onClick={() => setDrawMode('paint')}
              >
                {t('toolPaint')}
              </button>
              <button
                type="button"
                className={`notes-app__tool-btn${drawMode === 'eraser' ? ' notes-app__tool-btn--on' : ''}`}
                onClick={() => setDrawMode('eraser')}
              >
                {t('toolEraser')}
              </button>
            </div>
            {drawMode === 'paint' ? (
              <>
                <div className="notes-app__colors" role="group" aria-label={lang === 'pl' ? 'Kolor' : 'Color'}>
                  {PEN_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`notes-app__swatch${penColor === c ? ' notes-app__swatch--on' : ''}`}
                      style={{ background: c }}
                      aria-label={c}
                      onClick={() => setPenColor(c)}
                    />
                  ))}
                </div>
                <label className="notes-app__color-pick" title={t('customColor')}>
                  <span>{t('customColor')}</span>
                  <input type="color" value={penColor} onChange={(e) => setPenColor(e.target.value)} />
                </label>
              </>
            ) : null}
            <label className="notes-app__brush">
              <span>{lang === 'pl' ? 'Grubość' : 'Size'}</span>
              <input
                type="range"
                min={1}
                max={drawMode === 'eraser' ? 32 : 12}
                value={penWidth}
                onChange={(e) => setPenWidth(Number(e.target.value))}
              />
            </label>
          </>
        ) : null}
        <button type="button" className="notes-app__tool-btn" onClick={clearDrawings}>
          {t('clearDraw')}
        </button>
        <button type="button" className="notes-app__tool-btn notes-app__tool-btn--danger" onClick={clearAll}>
          {t('clearAll')}
        </button>
        <button type="button" className="notes-app__tool-btn notes-app__tool-btn--accent" onClick={toggleFullscreen}>
          {isFullscreen ? t('exitFullscreen') : t('fullscreen')}
        </button>
      </div>

      <div className="notes-app__stage">
        {tool === 'card' ? (
          <div
            className="notes-app__fmtbar"
            role="toolbar"
            aria-label={t('fmtTitle')}
            onPointerDown={(e) => e.preventDefault()}
          >
            <span className="notes-app__fmtbar-title">{t('fmtTitle')}</span>
            <button type="button" className="notes-app__fmt-btn" title={t('fmtBold')} onClick={() => runFormat('bold')}>
              <strong>B</strong>
            </button>
            <button type="button" className="notes-app__fmt-btn" title={t('fmtItalic')} onClick={() => runFormat('italic')}>
              <em>I</em>
            </button>
            <button
              type="button"
              className="notes-app__fmt-btn"
              title={t('fmtUnderline')}
              onClick={() => runFormat('underline')}
            >
              <u>U</u>
            </button>
            <button type="button" className="notes-app__fmt-btn" title="H1" onClick={() => runFormat('formatBlock', 'h1')}>
              H1
            </button>
            <button type="button" className="notes-app__fmt-btn" title="H2" onClick={() => runFormat('formatBlock', 'h2')}>
              H2
            </button>
            <button
              type="button"
              className="notes-app__fmt-btn"
              title={t('fmtBullet')}
              onClick={() => runFormat('insertUnorderedList')}
            >
              •
            </button>
            <select
              className="notes-app__fmt-select"
              aria-label={t('fmtSize')}
              defaultValue=""
              onChange={(e) => {
                const px = Number(e.target.value);
                if (px) applyFontSize(px);
                e.target.value = '';
              }}
            >
              <option value="" disabled>
                {t('fmtSize')}
              </option>
              {[12, 14, 16, 20, 28, 40].map((px) => (
                <option key={px} value={px}>
                  {px}px
                </option>
              ))}
            </select>
            <label className="notes-app__fmt-color" title={t('fmtTextColor')}>
              <span aria-hidden>A</span>
              <input type="color" defaultValue="#1a1a1a" onChange={(e) => applyTextColor(e.target.value)} />
            </label>
          </div>
        ) : null}

        <div
          ref={boardWrapRef}
          className={`notes-app__board${tool === 'draw' ? ' notes-app__board--draw' : ' notes-app__board--card'}`}
          onPointerDown={onBoardPointerDown}
          tabIndex={0}
        >
          <canvas
            ref={canvasRef}
            className="notes-app__canvas"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          />
          <div className="notes-app__cards">
            {images.map((image) => (
              <NotesBoardImage
                key={image.id}
                image={image}
                tool={tool}
                onUpdate={updateImage}
                onDelete={deleteImage}
              />
            ))}
            {cards.map((card) => (
              <NotesStickyCard
                key={card.id}
                card={card}
                tool={tool}
                active={activeCardId === card.id}
                placeholder={t('cardPlaceholder')}
                deleteLabel={t('deleteCard')}
                resizeLabel={t('resizeCard')}
                onDelete={deleteCard}
                onHtmlChange={onCardHtmlChange}
                onActivate={activateCard}
                onDragStart={onCardHeadPointerDown}
                onDragMove={onCardHeadPointerMove}
                onDragEnd={onCardHeadPointerUp}
                onResize={resizeCard}
              />
            ))}
          </div>
        </div>
      </div>
      </div>

      <p className="notes-app__hint">{t('hint')}</p>

      <SiteFooter lang={lang} appMeta={<SiteFooterAppMeta lang={lang} version={version} shortId={shortId || undefined} />} />
    </div>
  );
}
