import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Middleware — locale normalization + auth guard.
 *
 * Two responsibilities:
 *  1. English-only locale: any path not already under /en-US (including
 *     legacy /zh-CN links and unprefixed paths) is permanently (308)
 *     redirected to its /en-US equivalent. Locale negotiation is handled
 *     here instead of next-intl so the browser's Accept-Language can never
 *     serve a non-English locale.
 *  2. Auth guard: check for session token cookie on protected routes.
 *     Redirect unauthenticated users to /en-US/login, carrying the
 *     original path via ?redirect= (source router guard semantics).
 *     Redirect authenticated users away from /login back to the portal
 *     home /en-US/overview (源 beforeEach '/' → '/overview'；首登
 *     firstLogin 用户由客户端 SessionGuard 再拉回 /change-pwd ——
 *     middleware 读不到 localStorage 的 userInfo.firstLogin)。
 *
 * The token cookie (kissen_gateway_token) is written client-side by the
 * real login flow (kissen-gateway data-access auth.session saveGatewaySession
 * 双写 localStorage + cookie)；middleware only reads the cookie.
 */

/** Paths that don't require authentication */
const PUBLIC_PATHS = ['/login', '/api', '/kissen-api', '/_next'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.includes(p));
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // English-only system: any other locale prefix (e.g. legacy /zh-CN links)
  // or unprefixed path is permanently redirected to its /en-US equivalent.
  const localeMatch = pathname.match(/^\/en-US(\/.*)?$/);
  if (!localeMatch) {
    const foreign = pathname.match(/^\/[a-z]{2}-[A-Z]{2}(.*)$/);
    const rest = foreign ? foreign[1] || '/' : pathname || '/';
    const url = request.nextUrl.clone();
    url.pathname = `/en-US${rest}`;
    return NextResponse.redirect(url, 308);
  }
  const pathWithoutLocale = localeMatch[1] ?? '/';

  // Read token from cookie
  const token = request.cookies.get('kissen_gateway_token')?.value;
  const isAuthenticated = !!token;

  // Authenticated user on /login → redirect to portal home (源 beforeEach
  // '/'→'/overview'；首登用户由客户端 session-guard 二次分流到 /change-pwd)
  if (isAuthenticated && pathWithoutLocale === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = `/en-US/overview`;
    return NextResponse.redirect(url);
  }

  // Unauthenticated user on protected route → redirect to login
  // （源 router.beforeEach：`{ path: '/login', query: { redirect: to.fullPath } }`；
  //   登录页读取 redirect 优先跳回，兜底 /overview —— 见 login/page.tsx）
  if (!isAuthenticated && !isPublicPath(pathWithoutLocale)) {
    const url = request.nextUrl.clone();
    url.pathname = `/en-US/login`;
    // to.fullPath 等价：带 locale 前缀的完整路径 + 查询串，
    // searchParams.set 自行完成 URL 编码。
    url.searchParams.set(
      'redirect',
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/((?!api|kissen-api|_next|_vercel|.*\\..*).*)',
  ],
};
