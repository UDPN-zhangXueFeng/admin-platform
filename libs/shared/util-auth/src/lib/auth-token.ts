const ACCESS_TOKEN_KEY = 'admin_platform_access_token';
const TOKEN_COOKIE_KEY = 'admin_platform_token';
const USER_INFO_KEY = 'userInfo';
const USER_PERMISSION_KEY = 'userPermission';
const TWO_FACTOR_TOKEN_KEY = 'twoFactorToken';
const TODO_COUNT_KEY = 'todoCount';
const LAST_ACTIVITY_STORAGE_KEY = 'admin_platform_last_activity_at';
const LOCALE_PATTERN = /^\/(en-US|zh-CN)(?=\/|$)/;

interface StoredUserInfo {
  token?: string;
  [key: string]: unknown;
}

/**
 * Retrieves the current access token from localStorage.
 *
 * Returns `null` if no token is stored or if localStorage is unavailable
 * (e.g. during SSR in a non-browser environment).
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const storedUserInfo = getStoredUserInfo();
    if (storedUserInfo?.token) return storedUserInfo.token;
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Persists the access token to localStorage AND a cookie.
 *
 * Dual-strategy storage:
 * - **localStorage**: read by the Axios request interceptor (client-side API calls)
 * - **Cookie**: read by Next.js middleware (server-side auth guard)
 *
 * The cookie uses `SameSite=Lax` and `Path=/` so it's sent on
 * same-site navigations but not on cross-site requests.
 */
export function setAccessToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
    document.cookie = `${TOKEN_COOKIE_KEY}=${token}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`;
  } catch {
    // Silently fail in restricted environments (e.g. private mode)
  }
}

/**
 * Stores the full logged-in user snapshot for later token extraction and reload recovery.
 */
export function setStoredUserInfo(userInfo: StoredUserInfo): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo));
  } catch {
    // Silently fail in restricted environments
  }
}

/**
 * Reads the persisted user snapshot from localStorage.
 */
export function getStoredUserInfo(): StoredUserInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(USER_INFO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredUserInfo;
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Removes auth-related local state and the token cookie.
 */
export function clearSessionStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(USER_INFO_KEY);
    window.localStorage.removeItem(USER_PERMISSION_KEY);
    window.localStorage.removeItem(TWO_FACTOR_TOKEN_KEY);
    window.localStorage.removeItem(TODO_COUNT_KEY);
    window.localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
    // Expire the cookie immediately
    document.cookie = `${TOKEN_COOKIE_KEY}=; Path=/; SameSite=Lax; Max-Age=0`;
  } catch {
    // Silently fail in restricted environments
  }
}

/**
 * Backward-compatible alias for callers that only care about the token.
 */
export function removeAccessToken(): void {
  clearSessionStorage();
}

/**
 * Resolves the current locale-prefixed login path from `window.location`.
 *
 * Falls back to `/en-US/login` when the current URL has no supported locale prefix.
 */
export function getLoginRedirectPath(): string {
  if (typeof window === 'undefined') return '/en-US/login';

  const localeMatch = window.location.pathname.match(LOCALE_PATTERN);
  const locale = localeMatch?.[1] ?? 'en-US';
  return `/${locale}/login`;
}

/**
 * Clears the local session and redirects the browser to the locale-aware login page.
 */
export function logoutAndRedirect(): void {
  clearSessionStorage();

  if (typeof window !== 'undefined') {
    window.location.href = getLoginRedirectPath();
  }
}

/**
 * Cookie key — exported for use in middleware to read the token.
 */
export const TOKEN_COOKIE = TOKEN_COOKIE_KEY;
