import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/_next/static') || pathname.startsWith('/_next/image')) {
    return NextResponse.next();
  }

  const response = NextResponse.next(
    pathname.startsWith('/camera/obs/')
      ? { request: { headers: (() => { const h = new Headers(request.headers); h.set('x-obs-bare', '1'); return h; })() } }
      : undefined,
  );
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  response.headers.set('CDN-Cache-Control', 'no-store');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|icon|apple-icon|icon-192|icon-512|screenshot-wide|screenshot-narrow|manifest\\.webmanifest|sw\\.js).*)'],
};
