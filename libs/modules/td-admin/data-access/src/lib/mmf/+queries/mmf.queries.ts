'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  applyAccrualRecord,
  getAccrualDetail,
  getAccrualRecordList,
  getAccrualWalletRecords,
  getBatchApplyList,
  getBlockchainList,
  getFundList,
  getSettlementApprovalRecords,
  getSettlementDetail,
  getSettlementRecordList,
  getSettlementWalletRecords,
  getStablecoinSearches,
} from '../mmf.api';
import type {
  AccrualApplyReqVO,
  AccrualDetail,
  AccrualListParams,
  AccrualListResponse,
  AccrualWalletListParams,
  AccrualWalletRecord,
  BatchApplyListItem,
  BatchApplyListParams,
  BlockchainOption,
  FundOption,
  ResultPageInfo,
  SettlementApprovalListParams,
  SettlementApprovalRecord,
  SettlementDetail,
  SettlementListParams,
  SettlementListResponse,
  SettlementWalletListParams,
  SettlementWalletRecord,
  StablecoinSearchOption,
} from '../mmf.model';
import { mmfKeys } from './mmf.keys';

// ======================================================================
// 列表查询
// ======================================================================

/** 计提记录列表查询。 */
export function useAccrualRecordListQuery(params: AccrualListParams) {
  return useQuery<AccrualListResponse>({
    queryKey: mmfKeys.accrualList(params),
    queryFn: ({ signal }) => getAccrualRecordList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/** 结算记录列表查询。 */
export function useSettlementRecordListQuery(params: SettlementListParams) {
  return useQuery<SettlementListResponse>({
    queryKey: mmfKeys.settlementList(params),
    queryFn: ({ signal }) => getSettlementRecordList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

// ======================================================================
// 详情查询
// ======================================================================

/** 计提详情查询。accrualRecordId 缺失时不发起。 */
export function useAccrualDetailQuery(
  accrualRecordId: number | string | undefined,
  enabled = true,
) {
  return useQuery<AccrualDetail | undefined>({
    queryKey: mmfKeys.accrualDetail(accrualRecordId ?? ''),
    queryFn: ({ signal }) =>
      getAccrualDetail(accrualRecordId as number | string, { signal }),
    enabled: accrualRecordId != null && accrualRecordId !== '' && enabled,
  });
}

/** 结算详情查询。settlementId 缺失时不发起。 */
export function useSettlementDetailQuery(
  settlementId: number | string | undefined,
  enabled = true,
) {
  return useQuery<SettlementDetail | undefined>({
    queryKey: mmfKeys.settlementDetail(settlementId ?? ''),
    queryFn: ({ signal }) =>
      getSettlementDetail(settlementId as number | string, { signal }),
    enabled: settlementId != null && settlementId !== '' && enabled,
  });
}

// ======================================================================
// 子表格查询
// ======================================================================

/** 计提钱包明细子表格查询。 */
export function useAccrualWalletRecordsQuery(params: AccrualWalletListParams) {
  return useQuery<{ page?: ResultPageInfo; rows: AccrualWalletRecord[] }>({
    queryKey: mmfKeys.accrualWalletRecords(params),
    queryFn: ({ signal }) => getAccrualWalletRecords(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/** 结算钱包记录子表格查询（Tab1）。 */
export function useSettlementWalletRecordsQuery(
  params: SettlementWalletListParams,
) {
  return useQuery<{ page?: ResultPageInfo; rows: SettlementWalletRecord[] }>({
    queryKey: mmfKeys.settlementWalletRecords(params),
    queryFn: ({ signal }) => getSettlementWalletRecords(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/** 结算审批记录子表格查询（Tab2）。 */
export function useSettlementApprovalRecordsQuery(
  params: SettlementApprovalListParams,
) {
  return useQuery<{
    page?: ResultPageInfo;
    rows: SettlementApprovalRecord[];
  }>({
    queryKey: mmfKeys.settlementApprovalRecords(params),
    queryFn: ({ signal }) => getSettlementApprovalRecords(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

// ======================================================================
// 基金下拉
// ======================================================================

/** 基金下拉数据源（accrual + settlement 列表页共用）。 */
export function useFundListQuery() {
  return useQuery<FundOption[]>({
    queryKey: mmfKeys.fundList(),
    queryFn: ({ signal }) => getFundList({ signal }),
    staleTime: 5 * 60 * 1000,
  });
}

// ======================================================================
// 批量申报查询（Modal 内嵌可选静态表格，非分页，手动触发）
// ======================================================================

/** 批量申报查询。enabled=false 默认不发起，调用 refetch() 手动触发。 */
export function useBatchApplyListQuery(
  params: BatchApplyListParams,
  enabled = false,
) {
  return useQuery<BatchApplyListItem[]>({
    queryKey: mmfKeys.batchApplyList(params),
    queryFn: ({ signal }) => getBatchApplyList(params, { signal }),
    enabled,
  });
}

// ======================================================================
// 公共下拉查询
// ======================================================================

/** Stablecoin 下拉查询。 */
export function useStablecoinSearchesQuery() {
  return useQuery<StablecoinSearchOption[]>({
    queryKey: mmfKeys.stablecoinSearches(),
    queryFn: ({ signal }) => getStablecoinSearches({ signal }),
    staleTime: 5 * 60 * 1000,
  });
}

/** 区块链下拉查询。 */
export function useBlockchainListQuery() {
  return useQuery<BlockchainOption[]>({
    queryKey: mmfKeys.blockchainList(),
    queryFn: ({ signal }) => getBlockchainList({ signal }),
    staleTime: 5 * 60 * 1000,
  });
}

// ======================================================================
// Mutations
// ======================================================================

/** 计提申报 mutation（批量/单条统一入口）。
 *
 * - 批量申报：{ applyReqVOList, ruleId, totalAccrualUnits }
 * - 单条申报：{ applyReqVOList: [{ accrualRecordId, accrualUnits }] }
 *
 * 成功后失效计提列表 + 批量申报列表缓存。
 */
export function useApplyAccrualMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, AccrualApplyReqVO>({
    mutationFn: (dto) => applyAccrualRecord(dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: mmfKeys.accrual() });
    },
  });
}

/** 批量申报查询 mutation（手动触发，用于 Modal 内「查询」按钮）。
 *
 * 与 useBatchApplyListQuery 不同，此 mutation 适合与 Button onClick 绑定：
 * ```
 * const { mutate, data, isPending } = useBatchApplyListMutation();
 * <Button onClick={() => mutate({ ruleId, accrualTimeStartDate, accrualTimeEndDate })}>
 *   查询
 * </Button>
 * ```
 */
export function useBatchApplyListMutation() {
  return useMutation<BatchApplyListItem[], Error, BatchApplyListParams>({
    mutationFn: (params) => getBatchApplyList(params),
  });
}
