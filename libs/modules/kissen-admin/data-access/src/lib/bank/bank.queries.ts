'use client';

/** Bank domain read-query hooks. */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { bankKeys } from './bank.keys';
import { getBankDetail, getBankList } from './bank.api';
import type { BankListReq } from './bank.model';

/** Bank paged list (keepPreviousData keeps the table stable while paging). */
export function useBankListQuery(
  projectId: string,
  params: BankListReq,
  enabled = true,
) {
  return useQuery({
    queryKey: bankKeys.list(projectId, params),
    queryFn: ({ signal }) => getBankList(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Bank detail (disabled until a bankId is provided). */
export function useBankDetailQuery(
  projectId: string,
  bankId: number | null | undefined,
) {
  return useQuery({
    queryKey: bankId == null ? bankKeys.detail(projectId, -1) : bankKeys.detail(projectId, bankId),
    queryFn: ({ signal }) => getBankDetail(bankId as number, { signal }),
    enabled: bankId != null,
  });
}
