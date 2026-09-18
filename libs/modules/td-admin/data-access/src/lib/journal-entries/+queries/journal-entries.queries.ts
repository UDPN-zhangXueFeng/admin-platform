'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  addBillRule,
  createBillExportTask,
  editBillRule,
  getBillRuleDetail,
  getBillRuleList,
  getBillSubjectList,
  getBillTokenList,
  getBillTxList,
  getBillTxType,
  getBlockchainList,
  getCurrencyList,
  getInterestTxType,
  getStablecoinSearches,
  operateBillRule,
  saveBillSubject,
} from '../journal-entries.api';
import type {
  BillRuleDetail,
  BillRuleListParams,
  BillRuleListResponse,
  BillSubject,
  BillTokenOption,
  BillTxListParams,
  BillTxListResponse,
  BlockchainOption,
  CurrencyOption,
  ExportBillTxReq,
  InterestTxType,
  OperateBillRuleDTO,
  SaveBillRuleDTO,
  SaveSubjectDTO,
  StablecoinSearchOption,
} from '../journal-entries.model';
import { journalEntriesKeys } from './journal-entries.keys';

/** 规则列表查询。 */
export function useBillRuleListQuery(params: BillRuleListParams) {
  return useQuery<BillRuleListResponse>({
    queryKey: journalEntriesKeys.ruleList(params),
    queryFn: ({ signal }) => getBillRuleList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/** 规则详情查询。ruleId 缺失时不发起。 */
export function useBillRuleDetailQuery(
  ruleId: number | string | undefined,
  enabled = true,
) {
  return useQuery<BillRuleDetail | undefined>({
    queryKey: journalEntriesKeys.ruleDetail(ruleId ?? ''),
    queryFn: ({ signal }) =>
      getBillRuleDetail(ruleId as number | string, { signal }),
    enabled: ruleId != null && ruleId !== '' && enabled,
  });
}

/** token 下拉查询（add/tokenList）。 */
export function useBillTokenListQuery() {
  return useQuery<BillTokenOption[]>({
    queryKey: journalEntriesKeys.tokenList(),
    queryFn: ({ signal }) => getBillTokenList({ signal }),
  });
}

/** 科目下拉查询（add/subjectList，按 stablecoinId）。 */
export function useBillSubjectListQuery(
  stablecoinId: number | string | undefined,
  enabled = true,
) {
  return useQuery<BillSubject[]>({
    queryKey: journalEntriesKeys.subjectList(stablecoinId ?? ''),
    queryFn: ({ signal }) =>
      getBillSubjectList(stablecoinId as number | string, { signal }),
    enabled: stablecoinId != null && stablecoinId !== '' && enabled,
  });
}

/** 利息交易类型查询（interest/tx/type，按 stablecoinId）。 */
export function useInterestTxTypeQuery(
  stablecoinId: number | string | undefined,
  enabled = true,
) {
  return useQuery<InterestTxType[]>({
    queryKey: journalEntriesKeys.interestTxType(stablecoinId ?? ''),
    queryFn: ({ signal }) =>
      getInterestTxType(stablecoinId as number | string, { signal }),
    enabled: stablecoinId != null && stablecoinId !== '' && enabled,
  });
}

/** 账本交易列表查询（bill/otx/list，view 页）。 */
export function useBillTxListQuery(params: BillTxListParams) {
  return useQuery<BillTxListResponse>({
    queryKey: journalEntriesKeys.txList(params),
    queryFn: ({ signal }) => getBillTxList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/** txType 下拉查询（bill/tx/type，view 页）。 */
export function useBillTxTypeQuery(
  stablecoinId: number | string | undefined,
  enabled = true,
) {
  return useQuery<InterestTxType[]>({
    queryKey: journalEntriesKeys.txType(stablecoinId ?? ''),
    queryFn: ({ signal }) =>
      getBillTxType(stablecoinId as number | string, { signal }),
    enabled: stablecoinId != null && stablecoinId !== '' && enabled,
  });
}

/** 启用/禁用规则 mutation。 */
export function useOperateBillRuleMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, OperateBillRuleDTO>({
    mutationFn: (dto) => operateBillRule(dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: journalEntriesKeys.rules() });
    },
  });
}

/** 新增/编辑规则 mutation（add/edit，按 dto.ruleId 有无区分）。 */
export function useSaveBillRuleMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, SaveBillRuleDTO>({
    mutationFn: (dto) => (dto.ruleId ? editBillRule(dto) : addBillRule(dto)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: journalEntriesKeys.rules() });
    },
  });
}

/** 保存新科目 mutation。 */
export function useSaveBillSubjectMutation() {
  return useMutation<unknown, Error, SaveSubjectDTO>({
    mutationFn: (dto) => saveBillSubject(dto),
  });
}

/** 导出账本交易 mutation。 */
export function useCreateBillExportTaskMutation() {
  return useMutation<unknown, Error, ExportBillTxReq>({
    mutationFn: (req) => createBillExportTask(req),
  });
}

/** Stablecoin 下拉查询。 */
export function useStablecoinSearchesQuery() {
  return useQuery<StablecoinSearchOption[]>({
    queryKey: journalEntriesKeys.stablecoinSearches(),
    queryFn: ({ signal }) => getStablecoinSearches({ signal }),
  });
}

/** 区块链下拉查询。 */
export function useBlockchainListQuery() {
  return useQuery<BlockchainOption[]>({
    queryKey: journalEntriesKeys.blockchainList(),
    queryFn: ({ signal }) => getBlockchainList({ signal }),
  });
}

/** 货币下拉查询。 */
export function useCurrencyListQuery() {
  return useQuery<CurrencyOption[]>({
    queryKey: journalEntriesKeys.currencyList(),
    queryFn: ({ signal }) => getCurrencyList({ signal }),
  });
}
