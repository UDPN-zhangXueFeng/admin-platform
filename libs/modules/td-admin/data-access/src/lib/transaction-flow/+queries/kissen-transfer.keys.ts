import type {
  KissenTransferDetailParams,
  KissenTransferListParams,
} from '../kissen-transfer.model';

/** TanStack Query key 工厂。 */
export const kissenTransferKeys = {
  all: ['transaction-flow', 'kissen-transfer'] as const,
  list: (params: KissenTransferListParams) =>
    [...kissenTransferKeys.all, 'list', params] as const,
  detail: (params: KissenTransferDetailParams) =>
    [...kissenTransferKeys.all, 'detail', params] as const,
} as const;
