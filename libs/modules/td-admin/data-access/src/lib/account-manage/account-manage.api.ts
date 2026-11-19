import { apiClient } from '@myorg/shared/data-access-api';
import type {
  AccessKeyInfo,
  MetaMaskHistory,
  MetaMaskInfo,
  TwoFactorInfo,
  TwoFactorStatus,
} from './account-manage.model';
import { encrypt } from '../auth/encryption';

/**
 * Account-manage API.
 *
 * Every endpoint mirrors the upstream contract in td-manage
 * `src/lib/api/common.ts` (access key) and `src/lib/api/login.ts`
 * (MetaMask / 2FA). All requests are POST; `apiClient` unwraps the
 * `{ code, message, data }` envelope and throws on `code !== 0`.
 *
 * Passwords NEVER leave the browser in plaintext: `addTwoFactor` /
 * `disableTwoFactor` receive the plaintext password from the form and
 * apply the same AES-CBC encryption (`getEncryptionData` in the old
 * project) that the RBAC backend decrypts.
 */

// ── Access key ──────────────────────────────────────────────────────────────
// td-manage `getAccessKeyApi`: POST /api/rbac/v1/user/accessKey/get { accessKey }
export const fetchAccessKey = (key = '') =>
  apiClient.post<AccessKeyInfo>('/api/rbac/v1/user/accessKey/get', {
    accessKey: key,
  });

// ── MetaMask wallet ─────────────────────────────────────────────────────────
// td-manage `getUserInfo`: POST /api/rbac/v1/user/account/search (no body).
// Returns `null` when the user has no wallet bound.
export const fetchUserInfo = () =>
  apiClient.post<MetaMaskInfo | null>('/api/rbac/v1/user/account/search');

// td-manage `meatMaskHis`: POST /api/rbac/v1/user/account/history
export const fetchMetaMaskHistory = () =>
  apiClient.post<MetaMaskHistory[]>('/api/rbac/v1/user/account/history');

// td-manage `meatMaskAdd`: POST /api/rbac/v1/user/account/add { accountKey }
export const addMetaMask = (accountKey: string) =>
  apiClient.post<boolean>('/api/rbac/v1/user/account/add', { accountKey });

// td-manage `meatMaskEdit`: POST /api/rbac/v1/user/account/edit { accountKey }
export const editMetaMask = (accountKey: string) =>
  apiClient.post<boolean>('/api/rbac/v1/user/account/edit', { accountKey });

// td-manage `meatMaskStatusUp`: POST /api/rbac/v1/user/account/edit/status
export const disableMetaMask = () =>
  apiClient.post<boolean>('/api/rbac/v1/user/account/edit/status', {
    status: 1,
  });

// ── Two-factor authentication ───────────────────────────────────────────────
// td-manage `getTwoFactorStatus`: POST /api/rbac/v1/user/two/factor/search
export const fetchTwoFactorStatus = () =>
  apiClient.post<TwoFactorStatus>('/api/rbac/v1/user/two/factor/search');

// td-manage `getQrCode`: POST /api/rbac/v1/user/two/factor/generate/qr
export const fetchQrCode = () =>
  apiClient.post<TwoFactorInfo>('/api/rbac/v1/user/two/factor/generate/qr');

// td-manage `addTwoFactor`: POST /api/rbac/v1/user/two/factor/add
// Body: { code, password: AES(password) }
export const addTwoFactor = (params: { code: string; password: string }) =>
  apiClient.post<boolean>('/api/rbac/v1/user/two/factor/add', {
    code: params.code,
    password: encrypt(params.password),
  });

// td-manage `editTwoFactor`: POST /api/rbac/v1/user/two/factor/edit/status
// Body: { status: 1, password: AES(password) }
export const disableTwoFactor = (params: { password: string }) =>
  apiClient.post<boolean>('/api/rbac/v1/user/two/factor/edit/status', {
    status: 1,
    password: encrypt(params.password),
  });
