'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createExportTask,
  getAuditTrailDetail,
  getAuditTrailList,
  getBlockchainList,
  getStablecoinSearches,
} from '../audit-trail.api';
import type {
  AuditTrailDetail,
  AuditTrailListParams,
  AuditTrailListResponse,
  BlockchainOption,
  ExportAuditTaskReq,
  StablecoinSearchOption,
} from '../audit-trail.model';
import { auditTrailKeys } from './audit-trail.keys';

/** 列表查询（服务端分页，keepPreviousData）。 */
export function useAuditTrailListQuery(params: AuditTrailListParams) {
  return useQuery<AuditTrailListResponse>({
    queryKey: auditTrailKeys.list(params),
    queryFn: ({ signal }) => getAuditTrailList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/** 详情查询。traceId 缺失时不发起请求。 */
export function useAuditTrailDetailQuery(
  traceId: number | string | undefined,
  enabled = true,
) {
  return useQuery<AuditTrailDetail | undefined>({
    queryKey: auditTrailKeys.detail(traceId ?? ''),
    queryFn: ({ signal }) =>
      getAuditTrailDetail(traceId as number | string, { signal }),
    enabled: traceId != null && traceId !== '' && enabled,
  });
}

/** 导出任务 mutation（顶部 / 行 Download）。 */
export function useCreateExportTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, ExportAuditTaskReq>({
    mutationFn: (req: ExportAuditTaskReq) => createExportTask(req),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: auditTrailKeys.lists() });
    },
  });
}

/** Stablecoin 下拉查询。 */
export function useStablecoinSearchesQuery() {
  return useQuery<StablecoinSearchOption[]>({
    queryKey: auditTrailKeys.stablecoinSearches(),
    queryFn: ({ signal }) => getStablecoinSearches({ signal }),
  });
}

/** 区块链下拉查询。 */
export function useBlockchainListQuery() {
  return useQuery<BlockchainOption[]>({
    queryKey: auditTrailKeys.blockchainList(),
    queryFn: ({ signal }) => getBlockchainList({ signal }),
  });
}
