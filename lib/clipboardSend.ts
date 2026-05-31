export type ClipboardReadResult =
  | { ok: true; file: File; kind: 'image' | 'text' }
  | { ok: false; reason: 'empty' | 'denied' | 'unsupported' };

const clipStamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

const extForMime = (mime: string) => {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return 'bin';
};

/** Read clipboard as a sendable File — image preferred, then plain text. */
export async function fileFromClipboard(): Promise<ClipboardReadResult> {
  try {
    if (navigator.clipboard?.read) {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const buf = await blob.arrayBuffer();
          if (!buf.byteLength) continue;
          return {
            ok: true,
            kind: 'image',
            file: new File([buf], `schowek-${clipStamp()}.${extForMime(imageType)}`, { type: imageType }),
          };
        }
      }
    }

    if (navigator.clipboard?.readText) {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        return {
          ok: true,
          kind: 'text',
          file: new File([text], `schowek-${clipStamp()}.txt`, {
            type: 'text/plain;charset=utf-8',
          }),
        };
      }
    }

    return { ok: false, reason: 'empty' };
  } catch (err) {
    if (
      err instanceof DOMException &&
      (err.name === 'NotAllowedError' || err.name === 'SecurityError')
    ) {
      return { ok: false, reason: 'denied' };
    }
    return { ok: false, reason: 'unsupported' };
  }
}

export function textToFile(text: string, fileName: string) {
  return new File([text], fileName, { type: 'text/plain;charset=utf-8' });
}
