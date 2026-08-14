import type { TransactionListReq } from './transaction.model';

/** Transaction query key factory（携带 projectId 隔离缓存）。 */
export const transactionKeys = {
  all: (projectId: string) => ['project', projectId, 'transaction'] as const,
  lists: (projectId: string) =>
    [...transactionKeys.all(projectId), 'list'] as const,
  list: (projectId: string, params: TransactionListReq) =>
    [...transactionKeys.lists(projectId), params] as const,
  detail: (projectId: string, txId: number) =>
    [...transactionKeys.all(projectId), 'detail', txId] as const,
  chain: (projectId: string, txId: number) =>
    [...transactionKeys.all(projectId), 'chain', txId] as const,
  lpOptions: (projectId: string) =>
    [...transactionKeys.all(projectId), 'lp-options'] as const,
  pairOptions: (projectId: string) =>
    [...transactionKeys.all(projectId), 'pair-options'] as const,
  bankOptions: (projectId: string) =>
    [...transactionKeys.all(projectId), 'bank-options'] as const,
} as const;
