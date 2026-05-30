import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/_next/static') || pathname.startsWith('/_next/image')) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  response.headers.set('CDN-Cache-Control', 'no-store');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|icon\\.svg|manifest\\.webmanifest).*)'],
};
