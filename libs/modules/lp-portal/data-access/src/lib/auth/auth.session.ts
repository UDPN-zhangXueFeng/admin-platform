'use client';

/**
 * 会话持久化（源 `src/store/user.ts` 的 TOKEN_KEY/USER_KEY 语义 + 目标
 * middleware 的 cookie 要求）。
 *
 * 源仅用 localStorage（`kissen-lp.token` / `kissen-lp.user`，键名 1:1 保留）；
 * 目标 Next.js middleware 在服务端做路由守卫只能读 cookie `lp_portal_token`
 * （见 apps/lp-portal middleware / 工作清单 A3），因此登录时双写：
 * - localStorage：lp-client 请求拦截器读 token、刷新后恢复 userInfo（源语义）
 * - cookie：middleware 服务端守卫（SameSite=Lax，与 shared util-auth 同策略）
 */

import type { LoginRespVO } from './auth.model';

const TOKEN_KEY = 'kissen-lp.token';
const USER_KEY = 'kissen-lp.user';
/** middleware 读取的 cookie 名（apps/lp-portal 工作清单 A2/A3 约定）。 */
export const LP_TOKEN_COOKIE = 'lp_portal_token';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** 读取本地会话用户（LoginRespVO 全字段，含 firstLogin/menuTree/lpId；解析失败返回 null）。 */
export function getLpUser(): LoginRespVO | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(USER_KEY) ?? 'null') as
      | LoginRespVO
      | null;
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

/** 读取 token（localStorage，源 store.token 初始化；SSR/受限环境返回 null）。 */
export function getLpToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

/** 是否首次登录（firstLogin === 0，源 store.firstLogin computed）。 */
export function isFirstLogin(): boolean {
  return getLpUser()?.firstLogin === 0;
}

/** 保存会话：localStorage 双写 + middleware cookie（源 store.login 持久化语义）。 */
export function saveLpSession(user: LoginRespVO): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TOKEN_KEY, user.token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    document.cookie = `${LP_TOKEN_COOKIE}=${encodeURIComponent(
      user.token,
    )}; Path=/; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
  } catch {
    // 受限环境（如隐私模式）静默失败，与 shared util-auth 同策略
  }
}

/** 更新已存 userInfo（源 changePwd 成功后回写 firstLogin=1 的底层操作）。 */
export function updateLpUser(patch: Partial<LoginRespVO>): void {
  if (typeof window === 'undefined') return;
  const current = getLpUser();
  if (!current) return;
  saveLpSession({ ...current, ...patch });
}

/**
 * 改密成功：firstLogin 置 1（源 store.changePwd 内
 * `userInfo.firstLogin = 1` + 回写 localStorage，守卫因此放行）。
 */
export function markFirstLoginDone(): void {
  updateLpUser({ firstLogin: 1 });
}

/** 清空本地会话（源 store.clear()：token/userInfo 全清 + 失效 middleware cookie）。 */
export function clearLpSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    document.cookie = `${LP_TOKEN_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`;
  } catch {
    // 受限环境静默失败
  }
}
