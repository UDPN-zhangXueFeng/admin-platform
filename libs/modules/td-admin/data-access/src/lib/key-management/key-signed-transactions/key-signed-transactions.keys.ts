/**
 * TanStack Query key factory for key-signed-transactions.
 */

import type {
  KeyServiceConfigurationListParams,
  KeySignedTransactionListParams,
} from './key-signed-transactions.model';

export const keySignedTransactionKeys = {
  all: () => ['key-signed-transactions'] as const,
  lists: () => [...keySignedTransactionKeys.all(), 'list'] as const,
  list: (params: KeySignedTransactionListParams) =>
    [...keySignedTransactionKeys.lists(), params] as const,
  details: () => [...keySignedTransactionKeys.all(), 'detail'] as const,
  detail: (txRecordId: number) =>
    [...keySignedTransactionKeys.details(), txRecordId] as const,
  keyServices: () =>
    [...keySignedTransactionKeys.all(), 'key-services'] as const,
  stablecoins: () =>
    [...keySignedTransactionKeys.all(), 'stablecoins'] as const,
  blockchains: () =>
    [...keySignedTransactionKeys.all(), 'blockchains'] as const,
  keyServiceConfigurations: () =>
    [...keySignedTransactionKeys.all(), 'key-service-configurations'] as const,
  keyServiceConfigurationList: (params: KeyServiceConfigurationListParams) =>
    [...keySignedTransactionKeys.keyServiceConfigurations(), params] as const,
};
