/**
 * TanStack Query keys for the account-manage module.
 *
 * A single root lets write mutations invalidate the whole module namespace
 * (`accountManageKeys.all`) while still allowing targeted refreshes.
 */
const root = ['account-manage'] as const;

export const accountManageKeys = {
  all: root,
  accessKey: (key = '') => [...root, 'accessKey', key] as const,
  userInfo: () => [...root, 'userInfo'] as const,
  metaMaskHistory: () => [...root, 'metaMaskHistory'] as const,
  twoFactorStatus: () => [...root, 'twoFactorStatus'] as const,
  qrCode: () => [...root, 'qrCode'] as const,
};
