import { renderAppIcon } from '@/lib/pwaIconImage';

export const runtime = 'edge';
export const contentType = 'image/png';
export const size = { width: 180, height: 180 };

export default function AppleIcon() {
  return renderAppIcon(180);
}
