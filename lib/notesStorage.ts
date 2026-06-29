import type { NotesBoard } from '@/lib/notesProtocol';

const STORAGE_KEY = 'notes_saved_v1';
const MAX_NAME_LEN = 64;

export type SavedNote = {
  name: string;
  board: NotesBoard;
  updatedAt: number;
};

type SavedNotesIndex = Record<string, SavedNote>;

const normalizeName = (raw: string): string | null => {
  const name = raw.trim().slice(0, MAX_NAME_LEN);
  return name || null;
};

const readIndex = (): SavedNotesIndex => {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SavedNotesIndex;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeIndex = (index: SavedNotesIndex) => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(index));
};

export const listSavedNotes = (): SavedNote[] =>
  Object.values(readIndex()).sort((a, b) => b.updatedAt - a.updatedAt);

export const saveNote = (rawName: string, board: NotesBoard): SavedNote | null => {
  const name = normalizeName(rawName);
  if (!name) return null;
  const note: SavedNote = {
    name,
    board: {
      text: board.text,
      strokes: board.strokes.map((s) => ({ ...s, points: [...s.points] })),
      cards: board.cards.map((c) => ({ ...c })),
      images: board.images.map((i) => ({ ...i })),
    },
    updatedAt: Date.now(),
  };
  const index = readIndex();
  index[name] = note;
  writeIndex(index);
  return note;
};

export const loadNote = (rawName: string): SavedNote | null => {
  const name = normalizeName(rawName);
  if (!name) return null;
  return readIndex()[name] ?? null;
};

export const deleteNote = (rawName: string): boolean => {
  const name = normalizeName(rawName);
  if (!name) return false;
  const index = readIndex();
  if (!index[name]) return false;
  delete index[name];
  writeIndex(index);
  return true;
};
