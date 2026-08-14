import type { CurrencyListReq } from './currency.model';

/** 币种 query key factory（携带 projectId 隔离缓存）。 */
export const currencyKeys = {
  all: (projectId: string) => ['project', projectId, 'currency'] as const,
  lists: (projectId: string) => [...currencyKeys.all(projectId), 'list'] as const,
  list: (projectId: string, params: CurrencyListReq) =>
    [...currencyKeys.lists(projectId), params] as const,
  enabled: (projectId: string) =>
    [...currencyKeys.all(projectId), 'enabled'] as const,
} as const;
