/**
 * Interest 模块 TanStack Query hooks（查询端）。
 */
import { useQuery } from '@tanstack/react-query';
import {
  fetchAccrualHistoryList,
  fetchAccrualRecordDetail,
  fetchAccrualRecordList,
  fetchBlockchainOptions,
  fetchInterestPolicyDetail,
  fetchInterestPolicyList,
  fetchPolicyOperationRecords,
  fetchStablecoinOptions,
  fetchTokenBillDetail,
  fetchTokenBillList,
  fetchTransactionOperationRecords,
  fetchTransactionRecords,
} from '../interest.api';
import type {
  AccrualHistoryListFilters,
  AccrualRecordListFilters,
  InterestListParams,
  InterestRuleListFilters,
  PolicyOperationListFilters,
  TokenBillListFilters,
  TransactionOperationListFilters,
  TransactionRecordListFilters,
} from '../interest.model';
import { interestKeys } from './interest.keys';

// ── 公共下拉 hooks（多页面复用）──────────────────────────────────────────────

/** Token 下拉选项（stablecoin/enabled/searches），select 过滤空 id。 */
export function useStablecoinOptions() {
  return useQuery({
    queryKey: interestKeys.stablecoinOptions(),
    queryFn: fetchStablecoinOptions,
    staleTime: 5 * 60 * 1000,
    select: (data) =>
      (Array.isArray(data) ? data.filter((o) => o != null && o.stablecoinId !== '') : []).map(
        (el) => ({
          label: el.name,
          value: String(el.stablecoinId),
        }),
      ),
  });
}

/** 区块链下拉选项（blockchain/list），select 过滤空 key + 标记 disabled。 */
export function useBlockchainOptions() {
  return useQuery({
    queryKey: interestKeys.blockchainOptions(),
    queryFn: fetchBlockchainOptions,
    staleTime: 5 * 60 * 1000,
    select: (data) =>
      (Array.isArray(data) ? data.filter((o) => o != null && o.key !== '') : []).map((el) => ({
        label: el.value,
        value: String(el.key),
        disabled: el.status !== 1,
      })),
  });
}

// ── Policy 查询 ──────────────────────────────────────────────────────────────

export function useInterestPolicyList(
  params: InterestListParams<InterestRuleListFilters>,
) {
  return useQuery({
    queryKey: interestKeys.policyList(params.filters),
    queryFn: () => fetchInterestPolicyList(params),
  });
}

export function useInterestPolicyDetail(interestRuleId: number) {
  return useQuery({
    queryKey: interestKeys.policyDetail(interestRuleId),
    queryFn: () => fetchInterestPolicyDetail(interestRuleId),
    enabled: interestRuleId > 0,
  });
}

export function usePolicyOperationRecords(
  params: InterestListParams<PolicyOperationListFilters>,
) {
  return useQuery({
    queryKey: interestKeys.policyOperationRecords(params.filters),
    queryFn: () => fetchPolicyOperationRecords(params),
  });
}

// ── Accrual 查询 ─────────────────────────────────────────────────────────────

export function useAccrualRecordList(
  params: InterestListParams<AccrualRecordListFilters>,
) {
  return useQuery({
    queryKey: interestKeys.accrualList(params.filters),
    queryFn: () => fetchAccrualRecordList(params),
  });
}

export function useAccrualRecordDetail(accrualRecordId: number) {
  return useQuery({
    queryKey: interestKeys.accrualDetail(accrualRecordId),
    queryFn: () => fetchAccrualRecordDetail(accrualRecordId),
    enabled: accrualRecordId > 0,
  });
}

export function useAccrualHistoryList(
  params: InterestListParams<AccrualHistoryListFilters>,
) {
  return useQuery({
    queryKey: interestKeys.accrualHistoryList(params.filters),
    queryFn: () => fetchAccrualHistoryList(params),
  });
}

// ── Transactions 查询 ────────────────────────────────────────────────────────

export function useTokenBillList(
  params: InterestListParams<TokenBillListFilters>,
) {
  return useQuery({
    queryKey: interestKeys.tokenBillList(params.filters),
    queryFn: () => fetchTokenBillList(params),
  });
}

export function useTokenBillDetail(tokenBillId: number) {
  return useQuery({
    queryKey: interestKeys.tokenBillDetail(tokenBillId),
    queryFn: () => fetchTokenBillDetail(tokenBillId),
    enabled: tokenBillId > 0,
  });
}

export function useTransactionRecords(
  params: InterestListParams<TransactionRecordListFilters>,
) {
  return useQuery({
    queryKey: interestKeys.transactionRecords(params.filters),
    queryFn: () => fetchTransactionRecords(params),
  });
}

export function useTransactionOperationRecords(
  params: InterestListParams<TransactionOperationListFilters>,
) {
  return useQuery({
    queryKey: interestKeys.transactionOperationRecords(params.filters),
    queryFn: () => fetchTransactionOperationRecords(params),
  });
}
