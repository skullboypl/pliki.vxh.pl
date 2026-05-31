export const VXH_NOTE_PREFIX = 'VXH_';

/** Krótka, unikalna nazwa notatki — np. VXH_m2x7k9p4q.txt */
export function vxhTextNoteName() {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return `${VXH_NOTE_PREFIX}${id}.txt`;
}

export function isVxhTextNote(fileName: string) {
  return fileName.startsWith(VXH_NOTE_PREFIX) && fileName.toLowerCase().endsWith('.txt');
}

export function textToNoteFile(text: string) {
  return new File([text], vxhTextNoteName(), { type: 'text/plain;charset=utf-8' });
}

const extForImageMime = (mime: string) => {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return 'bin';
};

export function vxhImageName(mime: string) {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return `${VXH_NOTE_PREFIX}${id}.${extForImageMime(mime)}`;
}

export function fileFromPastedImage(blob: Blob, mime: string) {
  return new File([blob], vxhImageName(mime), { type: mime });
}
