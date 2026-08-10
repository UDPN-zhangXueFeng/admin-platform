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
 * In mock mode the token cookie is a fake value set by the mock login page.
 * Middleware only reads the cookie — it cannot access localStorage.
 */

const intlMiddleware = createMiddleware(routing);

/** Paths that don't require authentication */
const PUBLIC_PATHS = ['/login', '/api', '/kissen-api', '/_next'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.includes(p));
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Extract locale prefix from pathname (e.g. /en-US/login → en-US)
  const localeMatch = pathname.match(/^\/(en-US|zh-CN)(\/.*)?$/);
  const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;
  const pathWithoutLocale = localeMatch?.[2] ?? '/';

  // Read token from cookie
  const token = request.cookies.get('lp_portal_token')?.value;
  const isAuthenticated = !!token;

  // Authenticated user on /login → redirect to dashboard
  if (isAuthenticated && pathWithoutLocale === '/login') {
    url.pathname = `/${locale}/dashboard`;
    return NextResponse.redirect(url);
  }

  // Unauthenticated user on protected route → redirect to login
  if (!isAuthenticated && !isPublicPath(pathWithoutLocale)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  // Delegate to next-intl for locale handling
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    '/',
    '/((?!api|kissen-api|_next|_vercel|.*\\..*).*)',
  ],
};
