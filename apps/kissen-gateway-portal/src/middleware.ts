import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from '@myorg/shared/util-i18n';

/**
 * Next.js Middleware — locale detection + auth guard.
 *
 * Two responsibilities:
 *  1. Auth guard: check for session token cookie on protected routes.
 *     Redirect unauthenticated users to /[locale]/login, carrying the
 *     original path via ?redirect= (source router guard semantics).
 *     Redirect authenticated users away from /login back to the portal
 *     home /[locale]/onboard (源 '/' → '/onboard'；首登 firstLogin 用户
 *     由客户端 SessionGuard 再拉回 /change-pwd —— middleware 读不到
 *     localStorage 的 userInfo.firstLogin)。
 *  2. Locale: delegate to next-intl middleware for i18n routing.
 *
 * The token cookie (kissen_gateway_token) is written client-side by the
 * real login flow (kissen-gateway data-access auth.session saveGatewaySession
 * 双写 localStorage + cookie)；middleware only reads the cookie.
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
  const token = request.cookies.get('kissen_gateway_token')?.value;
  const isAuthenticated = !!token;

  // Authenticated user on /login → redirect to portal home (源 '/'→/onboard；
  // 首登用户由客户端 session-guard 二次分流到 /change-pwd)
  if (isAuthenticated && pathWithoutLocale === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/onboard`;
    return NextResponse.redirect(url);
  }

  // Unauthenticated user on protected route → redirect to login
  // （源 router.beforeEach：`{ path: '/login', query: { redirect: to.fullPath } }`；
  //   登录页读取 redirect 优先跳回，兜底 /onboard —— 见 login/page.tsx）
  if (!isAuthenticated && !isPublicPath(pathWithoutLocale)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    // to.fullPath 等价：带 locale 前缀的完整路径 + 查询串，
    // searchParams.set 自行完成 URL 编码。
    url.searchParams.set(
      'redirect',
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
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
