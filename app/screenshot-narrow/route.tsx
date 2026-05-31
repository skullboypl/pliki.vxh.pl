import { renderAppScreenshot } from '@/lib/pwaScreenshotImage';

export const runtime = 'nodejs';

export async function GET() {
  return renderAppScreenshot('narrow');
}
