import { axiosClient } from '@myorg/shared/data-access-api';
import { getAccessToken } from '@myorg/shared/util-auth';
import type {
  LoginReqVo,
  LoginRespVo,
  TwoFactorReq,
  MetaMaskLoginReq,
  AuthApiResponse,
} from '.';
import { encrypt } from './encryption';

/**
 * Whether a business code means success.
 *
 * The RBAC service returns `0` for success but has historically serialised it
 * as the string `"0"` as well (old td-manage `src/lib/axios.ts:60-61`
 * accepted both). A missing code is treated as success to stay compatible
 * with the previous behaviour.
 */
export function isAuthSuccessCode(
  code: number | string | null | undefined
): boolean {
  return code === 0 || code === '0' || code === null || code === undefined;
}

/**
 * Auth API — direct calls to the RBAC backend service.
 *
 * These functions return the raw Axios response (not unwrapped) because:
 * - Login needs the `randomstr` response header from captcha endpoint
 * - Login response envelope is checked for `code !== 0` before proceeding
 * - Some endpoints return blobs (captcha image)
 *
 * For typed unwrapping, use the TanStack Query mutations in auth.queries.ts.
 */

/** POST `/api/rbac/v1/login` — password + captcha login */
export async function loginApi(
  params: LoginReqVo,
  randomstr: string
) {
  return axiosClient.post<AuthApiResponse<LoginRespVo>>(
    '/api/rbac/v1/login',
    params,
    { headers: { randomstr } }
  );
}

/** POST `/api/rbac/v1/twoFactor/auth` — 2FA verification */
export async function loginTwoFactor(params: TwoFactorReq) {
  return axiosClient.post<AuthApiResponse<LoginRespVo>>(
    '/api/rbac/v1/twoFactor/auth',
    params
  );
}

/** GET `/api/rbac/v1/code/getCode` — captcha image + randomstr header */
export async function getCaptcha() {
  return axiosClient.get<Blob>('/api/rbac/v1/code/getCode', {
    responseType: 'blob',
  });
}

/** POST `/api/rbac/v1/user/account/allow/login` — check MetaMask status for user */
export async function checkMetaMaskStatus(params: { loginName: string }) {
  return axiosClient.post<AuthApiResponse<{ result: boolean }>>(
    '/api/rbac/v1/user/account/allow/login',
    params
  );
}

/** POST `/api/rbac/v1/user/account/login` — MetaMask wallet login */
export async function metaMaskLogin(
  params: MetaMaskLoginReq,
  randomstr: string
) {
  return axiosClient.post<AuthApiResponse<LoginRespVo>>(
    '/api/rbac/v1/user/account/login',
    params,
    { headers: { randomstr } }
  );
}

/**
 * Best-effort server-side logout that never blocks the caller.
 *
 * The RBAC logout endpoint takes ~10s on the live backend (the same call
 * returns in ~10ms once the token is already invalid), so awaiting it before
 * the local redirect leaves the user staring at a dead page for ten seconds.
 * The old td-manage project fired the request without awaiting it
 * (`src/lib/components/CustomMenus/Header.tsx:76-80`).
 *
 * `fetch` with `keepalive` lets the request outlive the navigation that
 * follows the local cleanup. The promise resolves as soon as the request is
 * dispatched — it never rejects on a network failure. `credentials: 'include'`
 * matches `axiosClient`'s `withCredentials: true` so the request behaves the
 * same when the API base URL points at another origin.
 */
export function logoutApiInBackground(): void {
  const token = getAccessToken();
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

  void fetch(`${baseUrl}/api/rbac/v1/logout`, {
    method: 'POST',
    headers: token ? { token } : {},
    credentials: 'include',
    keepalive: true,
  }).catch(() => {
    // The local session is already cleared; a failed server call is moot.
  });
}

/**
 * POST `/api/rbac/v1/user/password/modify` — change the current user's password.
 *
 * Both fields must be AES encrypted: the backend decrypts them before
 * comparing / storing (plaintext yields `MSG_01_1024` "Password decryption failed").
 */
export async function modifyPassword(params: {
  oldPassword: string;
  newPassword: string;
}) {
  return axiosClient.post<AuthApiResponse<null>>(
    '/api/rbac/v1/user/password/modify',
    {
      oldPassword: encrypt(params.oldPassword),
      newPassword: encrypt(params.newPassword),
    }
  );
}
