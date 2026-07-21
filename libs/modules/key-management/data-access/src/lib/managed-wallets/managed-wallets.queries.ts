/**
 * Managed Wallets read-query hooks.
 *
 * Bridges API calls with cache keys via TanStack Query.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  getManagedWallets,
  getManagedWalletDetail,
  getManagedWalletRotationHistory,
} from './managed-wallets.api';
import type {
  ManagedWalletListParams,
  WalletRotationHistoryParams,
} from './managed-wallets.model';
import { managedWalletKeys } from './managed-wallets.keys';

/** Paginated list of managed wallets. */
export function useManagedWalletsQuery(params: ManagedWalletListParams) {
  return useQuery({
    queryKey: managedWalletKeys.list(params),
    queryFn: ({ signal }) => getManagedWallets(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/** Single managed wallet detail. */
export function useManagedWalletDetailQuery(chainAccountId?: number) {
  return useQuery({
    queryKey: managedWalletKeys.detail(chainAccountId ?? 0),
    queryFn: ({ signal }) =>
      getManagedWalletDetail({ chainAccountId: chainAccountId! }, { signal }),
    enabled: Boolean(chainAccountId),
  });
}

/** Paginated rotation history for a wallet. */
export function useManagedWalletRotationHistoryQuery(
  params: WalletRotationHistoryParams,
) {
  return useQuery({
    queryKey: managedWalletKeys.rotationHistory(params),
    queryFn: ({ signal }) =>
      getManagedWalletRotationHistory(params, { signal }),
    placeholderData: keepPreviousData,
  });
}
