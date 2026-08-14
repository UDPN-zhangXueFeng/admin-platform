import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from '@myorg/shared/util-i18n';

/**
 * Next.js Middleware — locale detection + auth guard.
 *
 * Two responsibilities:
 *  1. Auth guard: check for session token cookie on protected routes.
 *     Redirect unauthenticated users to /[locale]/login.
 *     Redirect authenticated users away from /login back to dashboard.
 *  2. Locale: delegate to next-intl middleware for i18n routing.
 *
 * Mock mode: the token cookie is set by the mock login page. Middleware only
 * reads the cookie — no backend calls are made.
 */
const intlMiddleware = createMiddleware(routing);

/** Path prefixes that don't require authentication */
const PUBLIC_PATH_PREFIXES = ['/login', '/api', '/v1', '/_next'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Extract locale prefix from pathname (e.g. /en-US/login → en-US)
  const localeMatch = pathname.match(/^\/(en-US|zh-CN)(\/.*)?$/);
  const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;
  const pathWithoutLocale = localeMatch?.[2] ?? '/';

  // Read token from cookie — uses admin_platform_token (managed by
  // setAccessToken/clearSessionStorage in shared/util-auth) so that logout
  // clears it correctly. Previously read kissen_admin_token which was never
  // cleared, causing an auth-guard bypass after 401.
  const token = request.cookies.get('admin_platform_token')?.value;
  const isAuthenticated = !!token;

  // Authenticated user on /login or locale root → redirect to dashboard
  if (isAuthenticated && (pathWithoutLocale === '/login' || pathWithoutLocale === '/')) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/dashboard`;
    return NextResponse.redirect(url);
  }

  // Unauthenticated user on protected route → redirect to login
  if (!isAuthenticated && !isPublicPath(pathWithoutLocale)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    // Carry the original path (incl. query) so login can return the user
    // where they were (源 router/index.ts:64 /login?redirect=fullPath).
    url.searchParams.set('redirect', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  // Delegate to next-intl for locale handling
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    '/',
    '/((?!api|v1|_next|_vercel|.*\\..*).*)',
  ],
};
