export type StrokePoint = { x: number; y: number };

export type StrokeMode = 'paint' | 'eraser';

export type Stroke = {
  id: string;
  color: string;
  width: number;
  points: StrokePoint[];
  mode?: StrokeMode;
};

export type StickyCard = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  html: string;
  color: string;
};

export type BoardImage = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  src: string;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
};

export type NotesBoard = {
  text: string;
  strokes: Stroke[];
  cards: StickyCard[];
  images: BoardImage[];
};

export type NotesWireMessage =
  | { type: 'sync'; board: NotesBoard }
  | { type: 'text'; text: string }
  | { type: 'stroke'; stroke: Stroke }
  | { type: 'stroke-progress'; stroke: Stroke }
  | { type: 'card-add'; card: StickyCard }
  | { type: 'card-update'; card: StickyCard }
  | { type: 'card-live'; id: string; html: string }
  | { type: 'card-delete'; id: string }
  | { type: 'image-add'; image: BoardImage }
  | { type: 'image-update'; image: BoardImage }
  | { type: 'image-delete'; id: string }
  | { type: 'host-migrate'; successorId: string; sessionName: string; board: NotesBoard }
  | { type: 'clear' }
  | { type: 'bye' };

export const STICKY_COLORS = ['#fff9c4', '#ffcdd2', '#c8e6c9', '#bbdefb', '#e1bee7', '#ffe0b2'];

export const emptyBoard = (): NotesBoard => ({ text: '', strokes: [], cards: [], images: [] });

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

const normalizeCard = (raw: Partial<StickyCard>): StickyCard => ({
  id: raw.id || newCardId(),
  x: Number(raw.x) || 0,
  y: Number(raw.y) || 0,
  w: Number(raw.w) || 0.22,
  h: Number(raw.h) || 0.18,
  text: typeof raw.text === 'string' ? raw.text : '',
  html: typeof raw.html === 'string' && raw.html ? raw.html : escapeHtml(raw.text || ''),
  color: raw.color || STICKY_COLORS[0],
});

const normalizeImage = (raw: Partial<BoardImage>): BoardImage => ({
  id: raw.id || newImageId(),
  x: Number(raw.x) || 0,
  y: Number(raw.y) || 0,
  w: Number(raw.w) || 0.25,
  h: Number(raw.h) || 0.2,
  src: raw.src || '',
  cropX: Number(raw.cropX) || 0,
  cropY: Number(raw.cropY) || 0,
  cropW: Number(raw.cropW) || 1,
  cropH: Number(raw.cropH) || 1,
});

/** Migruje stare tablice do karteczek i obrazów. */
export const normalizeBoard = (raw: Partial<NotesBoard> | null | undefined): NotesBoard => {
  const strokes = Array.isArray(raw?.strokes) ? raw!.strokes : [];
  let cards = Array.isArray(raw?.cards) ? raw!.cards.map((c) => normalizeCard(c)) : [];
  const images = Array.isArray(raw?.images) ? raw!.images.map((i) => normalizeImage(i)) : [];
  const text = typeof raw?.text === 'string' ? raw.text : '';
  if (cards.length === 0 && text.trim()) {
    cards = [
      normalizeCard({
        id: newCardId(),
        x: 0.04,
        y: 0.04,
        w: 0.42,
        h: 0.28,
        text,
        color: STICKY_COLORS[0],
      }),
    ];
  }
  return { text: '', strokes, cards, images };
};

export const parseNotesMessage = (raw: string): NotesWireMessage | null => {
  try {
    const msg = JSON.parse(raw) as NotesWireMessage;
    if (!msg?.type) return null;
    return msg;
  } catch {
    return null;
  }
};

export const encodeNotesMessage = (msg: NotesWireMessage) => JSON.stringify(msg);

export const newStrokeId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const newCardId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `c-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const newImageId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `i-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const SESSION_PREFIX = { pl: ['Tablica', 'Szkic', 'Plan', 'Pomysł'], en: ['Board', 'Sketch', 'Plan', 'Idea'] } as const;

export const defaultSessionName = (lang: 'pl' | 'en' = 'pl'): string => {
  const words = SESSION_PREFIX[lang];
  const word = words[Math.floor(Math.random() * words.length)];
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${word}-${suffix}`;
};

export const pickHostSuccessor = (guestIds: string[], selfId: string): string | null => {
  const sorted = [...guestIds].sort();
  return sorted.find((id) => id !== selfId) ?? sorted[0] ?? null;
};
