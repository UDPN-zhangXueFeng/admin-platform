/**
 * TanStack Query key factory for managed-wallets.
 */

import type {
  ManagedWalletListParams,
  WalletRotationHistoryParams,
} from './managed-wallets.model';

export const managedWalletKeys = {
  all: () => ['managed-wallets'] as const,
  lists: () => [...managedWalletKeys.all(), 'list'] as const,
  list: (params: ManagedWalletListParams) =>
    [...managedWalletKeys.lists(), params] as const,
  details: () => [...managedWalletKeys.all(), 'detail'] as const,
  detail: (chainAccountId: number) =>
    [...managedWalletKeys.details(), chainAccountId] as const,
  rotationHistories: () =>
    [...managedWalletKeys.all(), 'rotation-history'] as const,
  rotationHistory: (params: WalletRotationHistoryParams) =>
    [...managedWalletKeys.rotationHistories(), params] as const,
};
