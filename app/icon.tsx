import { renderAppIcon } from '@/lib/pwaIconImage';

export const runtime = 'edge';
export const contentType = 'image/png';
export const size = { width: 512, height: 512 };

export default function Icon() {
  return renderAppIcon(512);
}
