import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { getAccessToken, logoutAndRedirect } from '@myorg/shared/util-auth';
import { ApiError } from './api-error';
import { normalizeApiError } from './api-error';
import { getMessage } from './api-messages';

/**
 * Subset of Axios request config exposed to consumers.
 *
 * Intentionally narrow: modules should not set `baseURL`, `timeout`,
 * or other transport-level concerns — those are owned by `axiosClient`.
 */
export type ApiRequestConfig = Pick<
  AxiosRequestConfig,
  'headers' | 'params' | 'signal'
>;

/**
 * Shared Axios instance.
 *
 * Configuration:
 * - `baseURL` from `NEXT_PUBLIC_API_BASE_URL`
 * - `timeout` 15 seconds
 * - `withCredentials` true (sends cookies for CORS)
 *
 * Interceptors:
 * - Request: injects `token` header (custom header required by the backend)
 * - Response: handles session-expiry codes (3/4) and normalises errors to {@link ApiError}
 */
export const axiosClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  timeout: 15_000,
  withCredentials: true,
});

const PUBLIC_AUTH_PATHS = [
  '/api/rbac/v1/code/getCode',
  '/api/rbac/v1/login',
  '/api/rbac/v1/twoFactor/auth',
  '/api/rbac/v1/user/account/allow/login',
  '/api/rbac/v1/user/account/login',
];

function isPublicAuthRequest(url?: string): boolean {
  if (!url) return false;
  return PUBLIC_AUTH_PATHS.some((path) => url.endsWith(path));
}

/**
 * Request interceptor — attaches the session token as a custom `token` header.
 *
 * The backend (RBAC service) expects `token: <value>` rather than the
 * standard `Authorization: Bearer <value>` pattern.
 */
axiosClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (isPublicAuthRequest(config.url)) {
    config.headers.delete('token');
    return config;
  }

  const token = getAccessToken();
  if (token) {
    config.headers.set('token', token);
  }
  return config;
});

/**
 * Response interceptor — two responsibilities:
 *
 * 1. **Session-expiry detection**: The backend signals expired/invalid
 *    sessions via `response.data.code === 3` or `code === 4`. When detected,
 *    the token is cleared and the user is redirected to the login page.
 *
 * 2. **Error normalisation**: All other Axios errors are wrapped in
 *    {@link ApiError} for consistent error handling in the UI layer.
 */
axiosClient.interceptors.response.use(
  (response) => {
    // Check for business-layer codes in successful HTTP responses
    const data = response.data as Record<string, unknown> | undefined;
    if (data && typeof data === 'object' && 'code' in data) {
      const code = data.code;
      if (code === 3 || code === 4 || code === '3' || code === '4') {
        logoutAndRedirect();
        return Promise.reject(new Error('Session expired'));
      }
      if (typeof code === 'number' && code !== 0) {
        const rawMessage =
          typeof data.message === 'string' ? data.message : undefined;
        return Promise.reject(
          new ApiError({
            status: response.status,
            code,
            message: getMessage(rawMessage),
          }),
        );
      }
    }
    return response;
  },
  (error) => {
    // HTTP 401 — also treat as session expired
    if (error.response?.status === 401) {
      logoutAndRedirect();
      return Promise.reject(new Error('Unauthorized'));
    }
    return Promise.reject(normalizeApiError(error));
  }
);
