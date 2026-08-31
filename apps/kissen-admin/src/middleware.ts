import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';


/** Path prefixes that don't require authentication */
const PUBLIC_PATH_PREFIXES = ['/login', '/api', '/v1', '/_next'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // English-only system: any other locale prefix (e.g. legacy /zh-CN links)
  // or unprefixed path is permanently redirected to its /en-US equivalent.
  // Locale negotiation is handled here instead of next-intl so the browser's
  // Accept-Language can never serve a non-English locale.
  const localeMatch = pathname.match(/^\/en-US(\/.*)?$/);
  if (!localeMatch) {
    const foreign = pathname.match(/^\/[a-z]{2}-[A-Z]{2}(.*)$/);
    const rest = foreign ? foreign[1] || '/' : pathname || '/';
    const url = request.nextUrl.clone();
    url.pathname = `/en-US${rest}`;
    return NextResponse.redirect(url, 308);
  }
  const pathWithoutLocale = localeMatch[1] ?? '/';

  // Read token from cookie — uses admin_platform_token (managed by
  // setAccessToken/clearSessionStorage in shared/util-auth) so that logout
  // clears it correctly. Previously read kissen_admin_token which was never
  // cleared, causing an auth-guard bypass after 401.
  const token = request.cookies.get('admin_platform_token')?.value;
  const isAuthenticated = !!token;

  // Authenticated user on /login or locale root → redirect to workbench
  // (backend menuTree menuUrl; /dashboard stays a registry alias)
  if (isAuthenticated && (pathWithoutLocale === '/login' || pathWithoutLocale === '/')) {
    const url = request.nextUrl.clone();
    url.pathname = `/en-US/workbench`;
    return NextResponse.redirect(url);
  }

  // Unauthenticated user on protected route → redirect to login
  if (!isAuthenticated && !isPublicPath(pathWithoutLocale)) {
    const url = request.nextUrl.clone();
    url.pathname = `/en-US/login`;
    // Carry the original path (incl. query) so login can return the user
    // where they were (源 router/index.ts:64 /login?redirect=fullPath).
    url.searchParams.set('redirect', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/((?!api|v1|_next|_vercel|.*\\..*).*)',
  ],
};
