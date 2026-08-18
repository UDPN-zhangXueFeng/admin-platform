'use client';

import type { LoginRespVO } from './auth.model';

/**
 * 会话持久化（源 `src/store/user.ts` 的 TOKEN_KEY/USER_KEY 语义 + 目标
 * middleware 的 cookie 要求）。
 *
 * 源仅用 localStorage（`bankgw.token` / `bankgw.user`）；目标 Next.js
 * middleware 在服务端做路由守卫，只能读 cookie `kissen_gateway_token`
 * （见 apps/kissen-gateway-portal/src/middleware.ts），因此登录时双写：
 * - localStorage：axios 请求拦截器读 token、刷新后恢复 userInfo（源语义）
 * - cookie：middleware 服务端守卫（SameSite=Lax，与 shared util-auth 同策略）
 */

const TOKEN_KEY = 'bankgw.token';
const USER_KEY = 'bankgw.user';
/** middleware 读取的 cookie 名（apps/kissen-gateway-portal/src/middleware.ts）。 */
export const GATEWAY_TOKEN_COOKIE = 'kissen_gateway_token';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function readStoredUser(): LoginRespVO | null {
  try {
    const raw = window.localStorage.getItem(USER_KEY) ?? 'null';
    const parsed = JSON.parse(raw) as LoginRespVO | null;
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

/** 读取 token（localStorage，源 store.token 初始化）。 */
export function getGatewayToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

/** 读取本地会话用户（LoginRespVO 全字段，含 firstLogin/menuKeys/loginName）。 */
export function getGatewayUser(): LoginRespVO | null {
  if (typeof window === 'undefined') return null;
  return readStoredUser();
}

/** 是否首次登录（firstLogin === 0，源 store.firstLogin computed）。 */
export function isFirstLogin(): boolean {
  return getGatewayUser()?.firstLogin === 0;
}

/** 保存会话：localStorage 双写 + middleware cookie。 */
export function saveGatewaySession(user: LoginRespVO): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TOKEN_KEY, user.token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    document.cookie = `${GATEWAY_TOKEN_COOKIE}=${encodeURIComponent(
      user.token,
    )}; Path=/; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
  } catch {
    // 受限环境（如隐私模式）静默失败，与 shared util-auth 同策略
  }
}

/** 更新已存 userInfo（源 changePwd 成功后回写 firstLogin=1）。 */
export function updateGatewayUser(patch: Partial<LoginRespVO>): void {
  if (typeof window === 'undefined') return;
  const current = readStoredUser();
  if (!current) return;
  saveGatewaySession({ ...current, ...patch });
}

/**
 * 改密成功：firstLogin 置 1（源 store.changePwd 内
 * `userInfo.firstLogin = 1` + 回写 localStorage）。
 */
export function markFirstLoginDone(): void {
  updateGatewayUser({ firstLogin: 1 });
}

/** 清空本地会话（源 store.clear()：token/userInfo 全清 + 失效 cookie）。 */
export function clearGatewaySession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    document.cookie = `${GATEWAY_TOKEN_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`;
  } catch {
    // 受限环境静默失败
  }
}
