'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { currencyPairKeys } from './currency-pair.keys';
import {
  getCurrencyPairBankCurrencies,
  getCurrencyPairList,
} from './currency-pair.api';
import type {
  CurrencyPairListFilter,
  CurrencyPairRow,
} from './currency-pair.model';
import type { PaginatedResponse } from '@myorg/shared/model';

/** 货币对分页列表（翻页/筛选时保留旧数据）。 */
export function useCurrencyPairListQuery(
  projectId: string,
  params: { pageNum: number; pageSize: number; filter: CurrencyPairListFilter },
  enabled = true,
) {
  return useQuery({
    queryKey: currencyPairKeys.list(projectId, {
      pageNum: params.pageNum,
      pageSize: params.pageSize,
      filter: params.filter,
    }),
    queryFn: ({ signal }) =>
      getCurrencyPairList(
        { pageNum: params.pageNum, pageSize: params.pageSize, filter: params.filter },
        { signal },
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** 已入网银行支持币种并集（货币对表单币种下拉数据源）。 */
export function useCurrencyPairBankCurrenciesQuery(
  projectId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: currencyPairKeys.bankCurrencies(projectId),
    queryFn: ({ signal }) => getCurrencyPairBankCurrencies({ signal }),
    enabled,
  });
}

/**
 * 单个货币对详情（无 detail 端点——源 pair-dialog 的 view/edit 模式接收列表行对象）。
 * 目标路由用 ?id=pairId 取数，只能列表回查定位：取较大页幅后按 pairId 查找。
 * 列表外（翻页不可见）的 pair 会显示未找到——已知限制，忠实于源无 detail 端点。
 */
export function useCurrencyPairDetailQuery(
  projectId: string,
  pairId: number | undefined,
) {
  return useQuery({
    queryKey: currencyPairKeys.detail(projectId, pairId ?? 0),
    queryFn: async ({ signal }): Promise<CurrencyPairRow | undefined> => {
      const res: PaginatedResponse<CurrencyPairRow> = await getCurrencyPairList(
        { pageNum: 1, pageSize: 200, filter: {} },
        { signal },
      );
      return res.data.find((r) => r.pairId === pairId);
    },
    enabled: pairId != null && pairId > 0,
  });
}
