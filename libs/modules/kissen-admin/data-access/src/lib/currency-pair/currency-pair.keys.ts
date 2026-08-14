import type { CurrencyPairListReq } from './currency-pair.model';

/** 货币对 query key factory（携带 projectId 隔离缓存）。 */
export const currencyPairKeys = {
  all: (projectId: string) => ['project', projectId, 'currency-pair'] as const,
  lists: (projectId: string) =>
    [...currencyPairKeys.all(projectId), 'list'] as const,
  list: (projectId: string, params: CurrencyPairListReq) =>
    [...currencyPairKeys.lists(projectId), params] as const,
  /** 银行支持币种（表单下拉数据源）。 */
  bankCurrencies: (projectId: string) =>
    [...currencyPairKeys.all(projectId), 'bank-currencies'] as const,
  /** 单个货币对（无 detail 端点，列表回查定位）。 */
  detail: (projectId: string, pairId: number) =>
    [...currencyPairKeys.all(projectId), 'detail', pairId] as const,
} as const;
