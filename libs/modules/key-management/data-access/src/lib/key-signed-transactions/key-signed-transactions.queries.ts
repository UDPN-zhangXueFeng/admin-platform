/**
 * Key-Signed Transactions read-query hooks.
 *
 * Bridges API calls with cache keys via TanStack Query.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  getBlockchainOptions,
  getKeyServicePlatforms,
  getKeySignedTransactionDetail,
  getKeySignedTransactions,
  getKeyServiceConfigurations,
  getStablecoinOptions,
} from './key-signed-transactions.api';
import type {
  KeyServiceConfigurationListParams,
  KeyServiceConfigurationListResponse,
  KeySignedTransactionListParams,
} from './key-signed-transactions.model';
import { keySignedTransactionKeys } from './key-signed-transactions.keys';

/** Paginated list of key-signed transactions. */
export function useKeySignedTransactionsQuery(
  params: KeySignedTransactionListParams,
) {
  return useQuery({
    queryKey: keySignedTransactionKeys.list(params),
    queryFn: ({ signal }) => getKeySignedTransactions(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/** Single transaction detail. */
export function useKeySignedTransactionDetailQuery(txRecordId?: number) {
  return useQuery({
    queryKey: keySignedTransactionKeys.detail(txRecordId ?? 0),
    queryFn: ({ signal }) =>
      getKeySignedTransactionDetail(txRecordId!, { signal }),
    enabled: Boolean(txRecordId),
  });
}

/** Key service platforms (for the "Key Service Name" filter). */
export function useKeyServicePlatformsQuery() {
  return useQuery({
    queryKey: keySignedTransactionKeys.keyServices(),
    queryFn: ({ signal }) => getKeyServicePlatforms({ signal }),
  });
}

/** Enabled stablecoins (for the "Token" filter). */
export function useStablecoinOptionsQuery() {
  return useQuery({
    queryKey: keySignedTransactionKeys.stablecoins(),
    queryFn: ({ signal }) => getStablecoinOptions({ signal }),
  });
}

/** Blockchain list (for the "Blockchain" filter). */
export function useBlockchainOptionsQuery() {
  return useQuery({
    queryKey: keySignedTransactionKeys.blockchains(),
    queryFn: ({ signal }) => getBlockchainOptions({ signal }),
  });
}

/** Key service configuration list with retained rows while paging. */
export function useKeyServiceConfigurationsQuery(
  params: KeyServiceConfigurationListParams,
) {
  return useQuery<KeyServiceConfigurationListResponse>({
    queryKey: keySignedTransactionKeys.keyServiceConfigurationList(params),
    queryFn: ({ signal }) => getKeyServiceConfigurations(params, { signal }),
    placeholderData: keepPreviousData,
  });
}
