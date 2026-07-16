import { axiosClient } from '@myorg/shared/data-access-api';
import type {
  LoginReqVo,
  LoginRespVo,
  TwoFactorReq,
  MetaMaskLoginReq,
  AuthApiResponse,
} from '@myorg/modules/auth/util';

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

/** POST `/api/rbac/v1/logout` — end session */
export async function logoutApi() {
  return axiosClient.post('/api/rbac/v1/logout');
}
