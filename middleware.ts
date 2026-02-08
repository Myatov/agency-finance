import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public: login page and all API routes
  if (pathname === '/login' || pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Client cabinet: enter by link (with or without token) is public
  if (pathname.startsWith('/cabinet/enter')) {
    return NextResponse.next();
  }

  // Client cabinet: dashboard and inner pages require portal session
  if (pathname.startsWith('/cabinet')) {
    const clientPortal = request.cookies.get('clientPortal')?.value;
    if (!clientPortal) {
      const enterUrl = new URL('/cabinet/enter', request.url);
      return NextResponse.redirect(enterUrl);
    }
    return NextResponse.next();
  }

  // CRM: require staff session
  const sessionId = request.cookies.get('session')?.value;
  if (!sessionId) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
