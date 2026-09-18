/**
 * User Wallets read-query hooks.
 *
 * Bridges API calls with cache keys via TanStack Query.
 */

import { useQuery } from '@tanstack/react-query';
import { getUserWallets } from './user-wallets.api';
import { userWalletKeys } from './user-wallets.keys';

/** Unpaginated list of user wallets (server returns full list, frontend handles pagination). */
export function useUserWalletsQuery() {
  return useQuery({
    queryKey: userWalletKeys.list(),
    queryFn: ({ signal }) => getUserWallets({ signal }),
  });
}
