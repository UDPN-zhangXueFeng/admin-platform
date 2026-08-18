'use client';

/**
 * 货币对域 read-query hooks（列表 + LP/汇率页货币对选择器共用数据源）。
 */
import { useQuery } from '@tanstack/react-query';

import { currencypairKeys } from './currencypair.keys';
import { getCurrencypairList } from './currencypair.api';

/** 货币对列表。 */
export function useCurrencypairListQuery() {
  return useQuery({
    queryKey: currencypairKeys.list(),
    queryFn: ({ signal }) => getCurrencypairList({ signal }),
  });
}
