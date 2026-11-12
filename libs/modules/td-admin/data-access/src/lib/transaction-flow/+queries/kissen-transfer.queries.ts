'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  getKissenTransferDetail,
  getKissenTransferList,
} from '../kissen-transfer.api';
import type {
  KissenTransferDetailParams,
  KissenTransferListParams,
} from '../kissen-transfer.model';
import { kissenTransferKeys } from './kissen-transfer.keys';

/** Kissen 跨行转账列表查询（翻页时保留上一页数据，避免表格闪烁）。 */
export function useKissenTransferList(params: KissenTransferListParams) {
  return useQuery({
    queryKey: kissenTransferKeys.list(params),
    queryFn: ({ signal }) => getKissenTransferList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/** Kissen 跨行转账详情查询；transactionId 无效时不发请求。 */
export function useKissenTransferDetail(params: KissenTransferDetailParams) {
  return useQuery({
    queryKey: kissenTransferKeys.detail(params),
    queryFn: ({ signal }) => getKissenTransferDetail(params, { signal }),
    enabled: params.transactionId > 0,
  });
}
