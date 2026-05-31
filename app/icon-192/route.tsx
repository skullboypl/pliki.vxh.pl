import { renderAppIcon } from '@/lib/pwaIconImage';

export const runtime = 'edge';

export async function GET() {
  return renderAppIcon(192);
}
