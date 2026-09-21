/**
 * Screening & Monitoring API（16 endpoint）。
 */
import { apiClient } from '@myorg/shared/data-access-api';
import type { BlockchainOption, BusinessTypeOption, RuleDetail, RuleListFilters, RuleListItem, RuleOperateParams, RuleOperationListFilters, RuleOperationLog, RuleOperationLogFilters, RuleOperationRecord, RuleSaveParams, ScreeningListParams, ScreeningListResponse, StablecoinOption, SuspiciousDetail, SuspiciousListFilters, SuspiciousProcessParams, SuspiciousRetryParams, SuspiciousTransaction, SuspiciousTransactionItem, SuspiciousTransactionListFilters } from './screening-monitoring.model';

const PREFIX = '/api/manage/v1/audit';

// 公共下拉
export const fetchStablecoinOptions = () => apiClient.get<StablecoinOption[]>('/api/manage/v1/common/stablecoin/enabled/searches');
export const fetchBlockchainOptions = () => apiClient.get<BlockchainOption[]>('/api/manage/v1/common/blockchain/list');
export const fetchBusinessTypeList = () => apiClient.post<BusinessTypeOption[]>(`${PREFIX}/rule/set/query/business/type/unit`, {});

// Rule set
export const fetchRuleList = (p: ScreeningListParams<RuleListFilters>) => apiClient.post<ScreeningListResponse<RuleListItem>>(`${PREFIX}/rule/set/list`, { data: p.filters, page: { pageNum: p.pageNum, pageSize: p.pageSize } });
export const fetchRuleDetail = (ruleId: number) => apiClient.post<RuleDetail>(`${PREFIX}/rule/set/detail`, { ruleId });
export const saveRule = (params: RuleSaveParams) => apiClient.post(`${PREFIX}/rule/set/save`, params);
export const editRule = (params: RuleSaveParams) => apiClient.post(`${PREFIX}/rule/set/edit`, params);
export const operateRule = (params: RuleOperateParams) => apiClient.post(`${PREFIX}/rule/set/operate`, params);
export const fetchRuleOperationRecords = (p: ScreeningListParams<RuleOperationListFilters>) => apiClient.post<ScreeningListResponse<RuleOperationRecord>>(`${PREFIX}/rule/set/operation/records`, { data: p.filters, page: { pageNum: p.pageNum, pageSize: p.pageSize } });
export const fetchRuleOperationLog = (p: ScreeningListParams<RuleOperationLogFilters>) => apiClient.post<ScreeningListResponse<RuleOperationLog>>(`${PREFIX}/rule/set/operation/log`, { data: p.filters, page: { pageNum: p.pageNum, pageSize: p.pageSize } });
export const fetchRuleUserList = (tokenId: number) => apiClient.post<{ emailList: string[] }>(`${PREFIX}/rule/set/user/list`, { tokenId });

// Suspicious
export const fetchSuspiciousList = (p: ScreeningListParams<SuspiciousListFilters>) => apiClient.post<ScreeningListResponse<SuspiciousTransaction>>(`${PREFIX}/rule/suspicious/list`, { data: p.filters, page: { pageNum: p.pageNum, pageSize: p.pageSize } });
export const fetchSuspiciousDetail = (suspiciousId: number) => apiClient.post<SuspiciousDetail>(`${PREFIX}/rule/suspicious/detail`, { suspiciousId });
export const fetchSuspiciousTransactionList = (p: ScreeningListParams<SuspiciousTransactionListFilters>) => apiClient.post<ScreeningListResponse<SuspiciousTransactionItem>>(`${PREFIX}/rule/suspicious/detail/transactionList`, { data: p.filters, page: { pageNum: p.pageNum, pageSize: p.pageSize } });
export const processSuspicious = (params: SuspiciousProcessParams) => apiClient.post(`${PREFIX}/rule/suspicious/process`, params);
export const retrySuspicious = (params: SuspiciousRetryParams) => apiClient.post(`${PREFIX}/rule/suspicious/retry`, params);
