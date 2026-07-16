'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createExportRule,
  createExportTask,
  deleteExportTask,
  getAllExportTaskList,
  getBlockchainList,
  getExportRuleDetail,
  getExportRuleList,
  getMyExportTaskList,
  getPermissionEmails,
  getStablecoinSearches,
  operateExportRule,
} from '../statements.api';
import type {
  BlockchainOption,
  CreateExportRuleDTO,
  CreateExportTaskDTO,
  DeleteExportTaskDTO,
  ExportRuleDetail,
  ExportRuleListParams,
  ExportRuleListResponse,
  ExportTaskListParams,
  ExportTaskListResponse,
  OperateExportRuleDTO,
  StablecoinSearchOption,
} from '../statements.model';
import { statementsKeys } from './statements.keys';

/** 规则列表查询。 */
export function useExportRuleListQuery(params: ExportRuleListParams) {
  return useQuery<ExportRuleListResponse>({
    queryKey: statementsKeys.ruleList(params),
    queryFn: ({ signal }) => getExportRuleList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/** 规则详情查询。exportRuleId 缺失时不发起。 */
export function useExportRuleDetailQuery(
  exportRuleId: number | string | undefined,
  enabled = true,
) {
  return useQuery<ExportRuleDetail | undefined>({
    queryKey: statementsKeys.ruleDetail(exportRuleId ?? ''),
    queryFn: ({ signal }) =>
      getExportRuleDetail(exportRuleId as number | string, { signal }),
    enabled: exportRuleId != null && exportRuleId !== '' && enabled,
  });
}

/** 我的导出任务列表查询。 */
export function useMyExportTaskListQuery(params: ExportTaskListParams) {
  return useQuery<ExportTaskListResponse>({
    queryKey: statementsKeys.myTaskList(params),
    queryFn: ({ signal }) => getMyExportTaskList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/** 全部导出文件列表查询（view 页，按 exportRuleId）。 */
export function useAllExportTaskListQuery(params: ExportTaskListParams) {
  return useQuery<ExportTaskListResponse>({
    queryKey: statementsKeys.allTaskList(params),
    queryFn: ({ signal }) => getAllExportTaskList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/** 新建规则 mutation（成功后失效规则列表）。 */
export function useCreateExportRuleMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, CreateExportRuleDTO>({
    mutationFn: (dto) => createExportRule(dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: statementsKeys.rules() });
    },
  });
}

/** 启用/禁用/删除规则 mutation。 */
export function useOperateExportRuleMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, OperateExportRuleDTO>({
    mutationFn: (dto) => operateExportRule(dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: statementsKeys.rules() });
    },
  });
}

/** 创建导出任务 mutation（成功后失效我的导出列表）。 */
export function useCreateExportTaskMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, CreateExportTaskDTO>({
    mutationFn: (dto) => createExportTask(dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: statementsKeys.tasks() });
    },
  });
}

/** 删除导出任务 mutation。 */
export function useDeleteExportTaskMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, DeleteExportTaskDTO>({
    mutationFn: (dto) => deleteExportTask(dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: statementsKeys.tasks() });
    },
  });
}

/** 全选用户邮箱 mutation（手动触发）。premissionType 1/2。 */
export function usePermissionEmailsMutation() {
  return useMutation<string[], Error, number>({
    mutationFn: (premissionType) => getPermissionEmails(premissionType),
  });
}

/** Stablecoin 下拉查询。 */
export function useStablecoinSearchesQuery() {
  return useQuery<StablecoinSearchOption[]>({
    queryKey: statementsKeys.stablecoinSearches(),
    queryFn: ({ signal }) => getStablecoinSearches({ signal }),
  });
}

/** 区块链下拉查询。 */
export function useBlockchainListQuery() {
  return useQuery<BlockchainOption[]>({
    queryKey: statementsKeys.blockchainList(),
    queryFn: ({ signal }) => getBlockchainList({ signal }),
  });
}
