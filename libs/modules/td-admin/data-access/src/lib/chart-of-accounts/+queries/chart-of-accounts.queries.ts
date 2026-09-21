'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  disableCoaAccounts,
  enableCoaAccounts,
  getChartOfAccountsList,
  getCoaBasicInfo,
  getCoaTree,
  getCurrencyList,
  getEodBalances,
  getEodStatementDetail,
  saveCoaAccounts,
  type EodBalancesRequest,
} from '../chart-of-accounts.api';
import type {
  ChartOfAccountsListParams,
  CurrencyOption,
} from '../chart-of-accounts.model';
import type {
  BookAccountBatchSaveReqVO,
  BookAccountToggleReqVO,
  ChartOfAccountsBasicInfoResp,
  CoaTreeNodeResp,
  EodBalancesPagedResp,
  EodDetailRespVo,
  LegacyEodBalancesResp,
} from '../chart-of-accounts-detail.model';
import { chartOfAccountsKeys } from './chart-of-accounts.keys';

/**
 * COA 列表查询 hook（服务端分页）。
 *
 * 使用 `keepPreviousData` 让翻页 / 筛选切换时旧数据保持可见，
 * 与源项目 `useSWR` + `isValidating` 的体验一致。
 */
export function useChartOfAccountsListQuery(params: ChartOfAccountsListParams) {
  return useQuery({
    queryKey: chartOfAccountsKeys.list(params),
    queryFn: ({ signal }) => getChartOfAccountsList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/**
 * 货币下拉查询 hook。
 *
 * 接口可能失败 / 返回为空，调用方据此回退到列表数据去重（见 feature 层）。
 */
export function useCurrencyListQuery() {
  return useQuery<CurrencyOption[]>({
    queryKey: chartOfAccountsKeys.currencies(),
    queryFn: ({ signal }) => getCurrencyList({ signal }),
  });
}

// ── 详情页 hooks ─────────────────────────────────────────────────────

/** 账本基本信息（Basic Information tab）。 */
export function useCoaBasicInfoQuery(financeBookId: number | undefined, enabled = true) {
  return useQuery<ChartOfAccountsBasicInfoResp>({
    queryKey: chartOfAccountsKeys.coaBasicInfo(financeBookId ?? 0),
    queryFn: ({ signal }) => getCoaBasicInfo(financeBookId as number, { signal }),
    enabled: Boolean(financeBookId) && enabled,
  });
}

/**
 * COA 树（Chart of Accounts tab）。
 * `retry: false`——失败由调用方回退到本地 mock（源项目 `shouldRetryOnError: false`）。
 */
export function useCoaTreeQuery(financeBookId: number | undefined, enabled = true) {
  return useQuery<CoaTreeNodeResp[]>({
    queryKey: chartOfAccountsKeys.coaTree(financeBookId ?? 0),
    queryFn: ({ signal }) => getCoaTree(financeBookId as number, { signal }),
    enabled: Boolean(financeBookId) && enabled,
    retry: false,
  });
}

/** EOD 余额列表（EOD Statements tab，服务端分页）。 */
export function useEodBalancesQuery(
  financeBookId: number | undefined,
  params: EodBalancesRequest,
  enabled = true
) {
  return useQuery<EodBalancesPagedResp | LegacyEodBalancesResp>({
    queryKey: chartOfAccountsKeys.eodBalances(financeBookId ?? 0, params),
    queryFn: ({ signal }) => getEodBalances(financeBookId as number, params, { signal }),
    enabled: Boolean(financeBookId) && enabled,
    retry: false,
  });
}

/** EOD 明细原始响应（EodDetailDrawer，由 buildEodStatementDetail 转换）。 */
export function useEodStatementDetailQuery(
  financeBookEodId: number | undefined,
  enabled = true
) {
  return useQuery<EodDetailRespVo>({
    queryKey: chartOfAccountsKeys.eodDetail(financeBookEodId ?? 0),
    queryFn: ({ signal }) => getEodStatementDetail(financeBookEodId as number, { signal }),
    enabled: Boolean(financeBookEodId) && enabled,
    retry: false,
  });
}

// ── 详情页 mutations ─────────────────────────────────────────────────

/** 批量保存 COA 账户；成功后失效 COA 树缓存。 */
export function useSaveCoaAccountsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: BookAccountBatchSaveReqVO) => saveCoaAccounts(req),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: chartOfAccountsKeys.coaTrees() }),
  });
}

/** 启用 / 停用账户；成功后失效 COA 树缓存。 */
export function useToggleCoaAccountsMutation(action: 'enable' | 'disable') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: BookAccountToggleReqVO) =>
      action === 'enable' ? enableCoaAccounts(req) : disableCoaAccounts(req),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: chartOfAccountsKeys.coaTrees() }),
  });
}
