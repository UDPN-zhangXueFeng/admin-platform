/**
 * Interest 模块 API（policy + accrual + transactions 三子域，17 端点）。
 *
 * 迁移自 td-manage `src/lib/api/interest.ts` + 各页面的 useSWR / useCustomTable 直传 URL。
 *
 * ## 前缀规则
 * - 全部 `POST` 请求，baseURL 由 `apiClient` 的 `NEXT_PUBLIC_API_BASE_URL` 兜底。
 * - `apiClient` 自动解包 `{ code, message, data }` 信封并在 code !== 0 时抛错。
 * - 列表请求统一使用 pageNum（非 page，对齐 sys/RBAC 域）。
 */

import {
  apiClient,
} from '@myorg/shared/data-access-api';
import type {
  AccrualHistoryItem,
  AccrualHistoryListFilters,
  AccrualRecord,
  AccrualRecordDetail,
  AccrualRecordListFilters,
  BlockchainOption,
  InterestListParams,
  InterestListResponse,
  InterestOperateParams,
  InterestRule,
  InterestRuleDetail,
  InterestRuleListFilters,
  InterestRuleSaveParams,
  PolicyOperationRecord,
  PolicyOperationListFilters,
  StablecoinOption,
  TokenBill,
  TokenBillDetail,
  TokenBillListFilters,
  TokenBillPostParams,
  TransactionOperationListFilters,
  TransactionOperationRecord,
  TransactionRecord,
  TransactionRecordListFilters,
} from './interest.model';

// ── URL 常量 ─────────────────────────────────────────────────────────────────

const INTEREST_PREFIX = '/api/manage/v1/manage/interest';

// 公共下拉
const STABLECOIN_SEARCHES_URL = '/api/manage/v1/common/stablecoin/enabled/searches';
const BLOCKCHAIN_LIST_URL = '/api/manage/v1/common/blockchain/list';

// Policy
const POLICY_LIST_URL = `${INTEREST_PREFIX}/list`;
const POLICY_DETAIL_URL = `${INTEREST_PREFIX}/detail`;
const POLICY_SAVE_URL = `${INTEREST_PREFIX}/save`;
const POLICY_EDIT_URL = `${INTEREST_PREFIX}/edit`;
const POLICY_OPERATE_URL = `${INTEREST_PREFIX}/operate`;
const POLICY_OPERATION_RECORDS_URL = `${INTEREST_PREFIX}/operation/records`;

// Accrual
const ACCRUAL_LIST_URL = `${INTEREST_PREFIX}/accrual/record/list`;
const ACCRUAL_DETAIL_URL = `${INTEREST_PREFIX}/accrual/record/detail`;
const ACCRUAL_HISTORY_LIST_URL = `${INTEREST_PREFIX}/accrual/record/history/list`;

// Transactions
const TX_LIST_URL = `${INTEREST_PREFIX}/tx/list`;
const TX_DETAIL_BASIC_URL = `${INTEREST_PREFIX}/tx/detail/basic`;
const TX_DETAIL_RECORDS_URL = `${INTEREST_PREFIX}/tx/detail/records`;
const TX_OPERATION_RECORDS_URL = `${INTEREST_PREFIX}/tx/operation/records`;
const TX_SAVE_URL = `${INTEREST_PREFIX}/tx/save`;
const TX_RETRY_URL = `${INTEREST_PREFIX}/tx/retry`;

// ── 公共下拉 API ─────────────────────────────────────────────────────────────

export function fetchStablecoinOptions() {
  return apiClient.get<StablecoinOption[]>(STABLECOIN_SEARCHES_URL);
}

export function fetchBlockchainOptions() {
  return apiClient.get<BlockchainOption[]>(BLOCKCHAIN_LIST_URL);
}

// ── Policy API ───────────────────────────────────────────────────────────────

export function fetchInterestPolicyList(
  params: InterestListParams<InterestRuleListFilters>,
) {
  return apiClient.post<InterestListResponse<InterestRule>>(
    POLICY_LIST_URL,
    { data: params.filters, page: { pageNum: params.pageNum, pageSize: params.pageSize } },
  );
}

export function fetchInterestPolicyDetail(interestRuleId: number) {
  return apiClient.post<InterestRuleDetail>(POLICY_DETAIL_URL, {
    interestRuleId,
  });
}

export function saveInterestPolicy(params: InterestRuleSaveParams) {
  return apiClient.post(POLICY_SAVE_URL, params);
}

export function editInterestPolicy(params: InterestRuleSaveParams) {
  return apiClient.post(POLICY_EDIT_URL, params);
}

export function operateInterestPolicy(params: InterestOperateParams) {
  return apiClient.post(POLICY_OPERATE_URL, params);
}

export function fetchPolicyOperationRecords(
  params: InterestListParams<PolicyOperationListFilters>,
) {
  return apiClient.post<InterestListResponse<PolicyOperationRecord>>(
    POLICY_OPERATION_RECORDS_URL,
    { data: params.filters, page: { pageNum: params.pageNum, pageSize: params.pageSize } },
  );
}

// ── Accrual API ──────────────────────────────────────────────────────────────

export function fetchAccrualRecordList(
  params: InterestListParams<AccrualRecordListFilters>,
) {
  return apiClient.post<InterestListResponse<AccrualRecord>>(
    ACCRUAL_LIST_URL,
    { data: params.filters, page: { pageNum: params.pageNum, pageSize: params.pageSize } },
  );
}

export function fetchAccrualRecordDetail(accrualRecordId: number) {
  return apiClient.post<AccrualRecordDetail>(ACCRUAL_DETAIL_URL, {
    accrualRecordId,
  });
}

export function fetchAccrualHistoryList(
  params: InterestListParams<AccrualHistoryListFilters>,
) {
  return apiClient.post<InterestListResponse<AccrualHistoryItem>>(
    ACCRUAL_HISTORY_LIST_URL,
    { data: params.filters, page: { pageNum: params.pageNum, pageSize: params.pageSize } },
  );
}

// ── Transactions API ─────────────────────────────────────────────────────────

export function fetchTokenBillList(
  params: InterestListParams<TokenBillListFilters>,
) {
  return apiClient.post<InterestListResponse<TokenBill>>(
    TX_LIST_URL,
    { data: params.filters, page: { pageNum: params.pageNum, pageSize: params.pageSize } },
  );
}

export function fetchTokenBillDetail(tokenBillId: number) {
  return apiClient.post<TokenBillDetail>(TX_DETAIL_BASIC_URL, {
    tokenBillId,
  });
}

export function fetchTransactionRecords(
  params: InterestListParams<TransactionRecordListFilters>,
) {
  return apiClient.post<InterestListResponse<TransactionRecord>>(
    TX_DETAIL_RECORDS_URL,
    { data: params.filters, page: { pageNum: params.pageNum, pageSize: params.pageSize } },
  );
}

export function fetchTransactionOperationRecords(
  params: InterestListParams<TransactionOperationListFilters>,
) {
  return apiClient.post<InterestListResponse<TransactionOperationRecord>>(
    TX_OPERATION_RECORDS_URL,
    { data: params.filters, page: { pageNum: params.pageNum, pageSize: params.pageSize } },
  );
}

export function postTokenBill(params: TokenBillPostParams) {
  return apiClient.post(TX_SAVE_URL, params);
}

export function retryTokenBill(params: TokenBillPostParams) {
  return apiClient.post(TX_RETRY_URL, params);
}
