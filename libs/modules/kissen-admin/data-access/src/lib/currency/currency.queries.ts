'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { currencyKeys } from './currency.keys';
import { getCurrencyEnabledList, getCurrencyList } from './currency.api';
import type { CurrencyListFilter } from './currency.model';

/** 币种分页列表（翻页/筛选时保留旧数据，提升体验）。 */
export function useCurrencyListQuery(
  projectId: string,
  params: { pageNum: number; pageSize: number; filter: CurrencyListFilter },
  enabled = true,
) {
  return useQuery({
    queryKey: currencyKeys.list(projectId, params),
    queryFn: ({ signal }) => getCurrencyList(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** 已启用币种全量（表单下拉/多选数据源）。 */
export function useCurrencyEnabledQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: currencyKeys.enabled(projectId),
    queryFn: ({ signal }) => getCurrencyEnabledList({ signal }),
    enabled,
  });
}
