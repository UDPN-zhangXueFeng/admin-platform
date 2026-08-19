import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Middleware — auth guard（工作清单 A2）。
 *
 * 两件事：
 *  1. Auth guard：受保护路由检查会话 cookie（lp_portal_token，登录时由
 *     data-access 的 saveLpSession 双写）。未登录 → /en-US/login（带
 *     redirect 回跳参数，源 router 守卫 `/login?redirect=<fullPath>` 语义）；
 *     已登录访问 /login → 回 /（客户端再按 menuKeys 做 root 落点探测）。
 *  2. Locale：English-only —— 非 /en-US 前缀（含遗留 /zh-CN 链接）与
 *     无前缀路径一律 308 永久重定向到对应 /en-US 路径。
 *
 * BFF 前缀 `/lp`（LP 后端代理）不参与鉴权匹配：matcher 正则直接排除 `lp`
 * 段，中间件根本不会拦截 API 请求（token 校验由后端 AuthFilter 承担）。
 */

/**
 * 无需登录的路径前缀（收紧为前缀匹配——原 includes() 子串匹配会把
 * /pool/api-x 之类误判为公开路径）。
 */
const PUBLIC_PATH_PREFIXES = ['/login', '/change-pwd'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
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

  // Read token from cookie（lp_portal_token：saveLpSession 写入/登出失效，
  // lp-client 401 分支 clearLpSession 同步清除此 cookie）。
  const token = request.cookies.get('lp_portal_token')?.value;
  const isAuthenticated = !!token;

  // Authenticated user on /login → redirect to /（客户端 root 落点按 menuKeys
  // 候选序探测，源 router 'redirect rootRedirect' 语义）。
  if (isAuthenticated && pathWithoutLocale === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = `/en-US`;
    return NextResponse.redirect(url);
  }

  // Unauthenticated user on protected route → redirect to login.
  if (!isAuthenticated && !isPublicPath(pathWithoutLocale)) {
    const url = request.nextUrl.clone();
    url.pathname = `/en-US/login`;
    // 携带原始路径（含 query），登录成功后回跳（源守卫 redirect=fullPath）。
    url.searchParams.set('redirect', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // 排除段：lp（BFF 前缀，A2：不参与鉴权匹配）、api、_next、_vercel、
  // 任何带扩展名的静态文件。
  matcher: ['/', '/((?!lp|api|kissen-api|_next|_vercel|.*\\..*).*)'],
};
