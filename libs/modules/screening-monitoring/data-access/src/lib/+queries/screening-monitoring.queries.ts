import { useQuery } from '@tanstack/react-query';
import { fetchBlockchainOptions, fetchBusinessTypeList, fetchRuleDetail, fetchRuleList, fetchRuleOperationLog, fetchRuleOperationRecords, fetchRuleUserList, fetchStablecoinOptions, fetchSuspiciousDetail, fetchSuspiciousList, fetchSuspiciousTransactionList } from '../screening-monitoring.api';
import type { RuleListFilters, RuleOperationListFilters, RuleOperationLogFilters, ScreeningListParams, SuspiciousListFilters, SuspiciousTransactionListFilters } from '../screening-monitoring.model';
import { screeningKeys } from './screening-monitoring.keys';

export const useStablecoinOptions = () => useQuery({ queryKey: screeningKeys.stablecoinOptions(), queryFn: fetchStablecoinOptions, staleTime: 300000, select: (d) => (Array.isArray(d) ? d.filter((o) => o != null && o.stablecoinId !== '').map((el) => ({ label: el.name, value: String(el.stablecoinId) })) : []) });
export const useBlockchainOptions = () => useQuery({ queryKey: screeningKeys.blockchainOptions(), queryFn: fetchBlockchainOptions, staleTime: 300000, select: (d) => (Array.isArray(d) ? d.filter((o) => o != null && o.key !== '').map((el) => ({ label: el.value, value: String(el.key), disabled: el.status !== 1 })) : []) });
export const useBusinessTypeList = () => useQuery({ queryKey: screeningKeys.businessTypeList(), queryFn: fetchBusinessTypeList, staleTime: 300000, select: (d) => (Array.isArray(d) ? d.filter((o) => o != null).map((el) => ({ label: el.businessName, value: el.businessType, unitList: el.unitList })) : []) });

export const useRuleList = (p: ScreeningListParams<RuleListFilters>) => useQuery({ queryKey: screeningKeys.ruleList(p.filters as Record<string, unknown>), queryFn: () => fetchRuleList(p) });
export const useRuleDetail = (id: number) => useQuery({ queryKey: screeningKeys.ruleDetail(id), queryFn: () => fetchRuleDetail(id), enabled: id > 0 });
export const useRuleOperationRecords = (p: ScreeningListParams<RuleOperationListFilters>) => useQuery({ queryKey: screeningKeys.ruleOperationRecords(p.filters as Record<string, unknown>), queryFn: () => fetchRuleOperationRecords(p) });
export const useRuleOperationLog = (p: ScreeningListParams<RuleOperationLogFilters>) => useQuery({ queryKey: screeningKeys.ruleOperationLog(p.filters as Record<string, unknown>), queryFn: () => fetchRuleOperationLog(p) });
export const useRuleUserList = (tokenId: number) => useQuery({ queryKey: screeningKeys.ruleUserList(tokenId), queryFn: () => fetchRuleUserList(tokenId), enabled: tokenId > 0 });

export const useSuspiciousList = (p: ScreeningListParams<SuspiciousListFilters>) => useQuery({ queryKey: screeningKeys.suspiciousList(p.filters as Record<string, unknown>), queryFn: () => fetchSuspiciousList(p) });
export const useSuspiciousDetail = (id: number) => useQuery({ queryKey: screeningKeys.suspiciousDetail(id), queryFn: () => fetchSuspiciousDetail(id), enabled: id > 0 });
export const useSuspiciousTransactions = (p: ScreeningListParams<SuspiciousTransactionListFilters>) => useQuery({ queryKey: screeningKeys.suspiciousTransactions(p.filters as Record<string, unknown>), queryFn: () => fetchSuspiciousTransactionList(p) });
