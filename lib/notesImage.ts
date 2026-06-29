const MAX_SIDE = 1280;
const JPEG_QUALITY = 0.82;

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

export const compressImageToDataUrl = async (src: string, maxSide = MAX_SIDE): Promise<string> => {
  const img = await loadImage(src);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return src;
  ctx.drawImage(img, 0, 0, w, h);
  const asJpeg = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  return asJpeg.length < src.length ? asJpeg : src;
};

export const readFileAsImageDataUrl = async (file: File): Promise<string | null> => {
  if (!file.type.startsWith('image/')) return null;
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return compressImageToDataUrl(raw);
};

export const readBlobAsImageDataUrl = async (blob: Blob): Promise<string | null> => {
  if (!blob.type.startsWith('image/')) return null;
  return readFileAsImageDataUrl(new File([blob], 'paste.jpg', { type: blob.type }));
};

export const imageAspect = async (src: string): Promise<number> => {
  const img = await loadImage(src);
  return img.width / img.height || 1;
};
