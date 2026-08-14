'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { rateKeys } from './rate.keys';
import { getRateList } from './rate.api';
import type { RateListFilter, RateRecordRow } from './rate.model';
import type { PaginatedResponse } from '@myorg/shared/model';

/** 加价率变更记录分页列表（翻页/筛选时保留旧数据）。 */
export function useRateListQuery(
  projectId: string,
  params: { pageNum: number; pageSize: number; filter: RateListFilter },
  enabled = true,
) {
  return useQuery({
    queryKey: rateKeys.list(projectId, {
      pageNum: params.pageNum,
      pageSize: params.pageSize,
      filter: params.filter,
    }),
    queryFn: ({ signal }) =>
      getRateList(
        { pageNum: params.pageNum, pageSize: params.pageSize, filter: params.filter },
        { signal },
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/**
 * 指定货币对的变更记录（源 rate-history-dialog：rateList filtered by pairId）。
 * 变更记录弹窗数据源。
 */
export function useRateHistoryQuery(
  projectId: string,
  pairId: number | undefined,
  pageNum = 1,
  pageSize = 10,
) {
  return useQuery({
    queryKey: rateKeys.history(projectId, pairId ?? 0, pageNum, pageSize),
    queryFn: ({ signal }) =>
      getRateList(
        { pageNum, pageSize, filter: { pairId } },
        { signal },
      ),
    enabled: pairId != null && pairId > 0,
  });
}

/**
 * 单条变更记录详情（无 detail 端点——源 rateList 返回完整记录）。
 * 列表回查定位：取较大页幅后按 recordId 查找。已知限制。
 */
export function useRateDetailQuery(
  projectId: string,
  recordId: number | undefined,
) {
  return useQuery({
    queryKey: rateKeys.detail(projectId, recordId ?? 0),
    queryFn: async ({ signal }): Promise<RateRecordRow | undefined> => {
      const res: PaginatedResponse<RateRecordRow> = await getRateList(
        { pageNum: 1, pageSize: 200, filter: {} },
        { signal },
      );
      return res.data.find((r) => r.recordId === recordId);
    },
    enabled: recordId != null && recordId > 0,
  });
}
