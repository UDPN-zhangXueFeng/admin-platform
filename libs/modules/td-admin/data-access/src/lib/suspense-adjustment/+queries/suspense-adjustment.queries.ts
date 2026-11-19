'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  getSuspenseAdjustmentDetail,
  getSuspenseAdjustmentList,
  getSuspenseEntryDetail,
  getTxAccountsLeaf,
  submitSuspenseAdjustment,
} from '../suspense-adjustment.api';
import type {
  AdjustedDetailDomain,
  AdjustmentSubmitResult,
  LeafAccountsResp,
  NewAdjustmentForm,
  SuspenseAdjustmentDetail,
  SuspenseAdjustmentListQuery,
  SuspenseAdjustmentListResponse,
} from '../suspense-adjustment.model';
import { suspenseAdjustmentKeys } from './suspense-adjustment.keys';

/**
 * 列表查询（筛选切换时旧数据保持可见）。
 */
export function useSuspenseAdjustmentListQuery(query: SuspenseAdjustmentListQuery) {
  return useQuery<SuspenseAdjustmentListResponse>({
    queryKey: suspenseAdjustmentKeys.list(query),
    queryFn: ({ signal }) => getSuspenseAdjustmentList(query, { signal }),
    placeholderData: keepPreviousData,
  });
}

/** 暂记分录详情查询（详情页）。suspenseRecordId 缺失时不发起请求。 */
export function useSuspenseEntryDetailQuery(
  suspenseRecordId: number | undefined,
  enabled = true,
) {
  return useQuery<SuspenseAdjustmentDetail | null>({
    queryKey: suspenseAdjustmentKeys.entryDetail(suspenseRecordId ?? 0),
    queryFn: ({ signal }) =>
      getSuspenseEntryDetail(suspenseRecordId as number, { signal }),
    enabled: Boolean(suspenseRecordId) && enabled,
  });
}

/** 调账 / 审批详情查询（编辑页回显 / 审批详情）。adjustmentId 缺失时不发起请求。 */
export function useSuspenseAdjustmentDetailQuery(
  adjustmentId: number | undefined,
  enabled = true,
) {
  return useQuery<AdjustedDetailDomain | null>({
    queryKey: suspenseAdjustmentKeys.adjustmentDetail(adjustmentId ?? 0),
    queryFn: ({ signal }) =>
      getSuspenseAdjustmentDetail(adjustmentId as number, { signal }),
    enabled: Boolean(adjustmentId) && enabled,
  });
}

/** 末级科目下拉查询（编辑页选科目）。financeBookId 缺失时不发起请求。 */
export function useTxAccountsLeafQuery(
  financeBookId: number | undefined,
  enabled = true,
) {
  return useQuery<LeafAccountsResp | null>({
    queryKey: suspenseAdjustmentKeys.accountOptions(financeBookId ?? 0),
    queryFn: ({ signal }) =>
      getTxAccountsLeaf(financeBookId as number, { signal }),
    enabled: Boolean(financeBookId) && enabled,
  });
}

/**
 * 提交暂记调账 mutation。
 * 成功后失效列表和受影响的记录详情。
 */
export function useSubmitSuspenseAdjustmentMutation() {
  const queryClient = useQueryClient();
  return useMutation<AdjustmentSubmitResult | null, Error, NewAdjustmentForm>({
    mutationFn: (form: NewAdjustmentForm) => submitSuspenseAdjustment(form),
    onSuccess: (_, form) => Promise.all([
      queryClient.invalidateQueries({ queryKey: suspenseAdjustmentKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: suspenseAdjustmentKeys.entryDetail(form.suspenseRecordId) }),
    ]),
  });
}
