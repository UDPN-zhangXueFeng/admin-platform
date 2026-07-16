import { apiClient, type ApiRequestConfig } from '@myorg/shared/data-access-api';
import {
  CLEAR_STATUS_ENUM_TO_CODE,
  SOURCE_TYPE_ENUM_TO_CODE,
  dateStringToEpoch,
} from '@myorg/modules/suspense-adjustment/util';
import {
  adaptAdjustSubmitResult,
  adaptSuspenseAdjustmentDetail,
  adaptSuspenseAdjustmentListItem,
  adaptSuspenseEntryDetail,
  type SuspenseAdjustListRespVO,
  type SuspenseAdjustRespVO,
  type SuspenseAdjustmentApprovalDetailVO,
  type SuspenseEntryDetailRespVO,
} from './suspense-adjustment.adapters';
import type {
  AdjustmentSubmitResult,
  AdjustedDetailDomain,
  LeafAccountsResp,
  NewAdjustmentForm,
  SuspenseAdjustmentDetail,
  SuspenseAdjustmentListQuery,
  SuspenseAdjustmentListResponse,
} from './suspense-adjustment.model';
import { buildAdjustPayload } from './suspense-adjustment.utils';

/**
 * Suspense Adjustment API。
 *
 * 所有 endpoint base：`/api/finance/v1/finance/suspense-adjustment/`（源自
 * td-manage api.ts，已确认）。`apiClient` 自动解包 `{ code, message, data }` 信封
 * 并在 `code !== 0` 时抛错，故各函数返回值即信封内 data（经 adapter 转 Domain）。
 *
 * 不迁移源的 MOCK 开关 / SWR / customFetch（与 posting-engine 一致，靠 query
 * loading / empty 降级）。
 */
const BASE = '/api/finance/v1/finance/suspense-adjustment';
const LIST_URL = `${BASE}/list`;
const ENTRY_DETAIL_URL = `${BASE}/entry-detail`;
const ADJUST_URL = `${BASE}/adjust`;
const DETAIL_URL = `${BASE}/detail`;

/**
 * 列表查询 Domain → 后端请求体。
 * - postingDate 字符串 → epoch millis（endDate 取当日 23:59:59.999 闭合区间）。
 * - sourceType / status 枚举 → 后端数值编码（ALL 不传）。
 */
const buildListPayload = (
  query: SuspenseAdjustmentListQuery,
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  if (query.sourceType && query.sourceType !== 'ALL') {
    payload.sourceType = SOURCE_TYPE_ENUM_TO_CODE[query.sourceType];
  }
  if (query.status && query.status !== 'ALL') {
    payload.clearStatus = CLEAR_STATUS_ENUM_TO_CODE[query.status];
  }
  const startDate = dateStringToEpoch(query.postingDateStart);
  const endDate = dateStringToEpoch(query.postingDateEnd);
  if (startDate != null) payload.startDate = startDate;
  if (endDate != null) {
    payload.endDate = endDate + 86_400_000 - 1;
  }
  if (query.suspenseTxnId?.trim())
    payload.suspenseTxnId = query.suspenseTxnId.trim();
  if (query.transactionId?.trim())
    payload.transactionId = query.transactionId.trim();
  return payload;
};

/** 后端列表响应原始结构（rows 无 id，由 adapter 注入）。 */
interface ListResponseApi {
  rows?: SuspenseAdjustListRespVO[];
  page?: { total?: number };
}

/**
 * 列表查询（/list）。前端无真实分页，total 取 rows.length。
 */
export async function getSuspenseAdjustmentList(
  query: SuspenseAdjustmentListQuery,
  config?: ApiRequestConfig,
): Promise<SuspenseAdjustmentListResponse> {
  const response = await apiClient.post<ListResponseApi>(
    LIST_URL,
    buildListPayload(query),
    config,
  );
  const rows = (response.rows ?? []).map(adaptSuspenseAdjustmentListItem);
  return { page: { total: response.page?.total ?? rows.length }, rows };
}

/**
 * 暂记分录详情（/entry-detail，列表 → 详情页）。后端 data 缺失时返回 undefined。
 */
export async function getSuspenseEntryDetail(
  suspenseRecordId: number,
  config?: ApiRequestConfig,
): Promise<SuspenseAdjustmentDetail | undefined> {
  const vo = await apiClient.post<SuspenseEntryDetailRespVO | null>(
    ENTRY_DETAIL_URL,
    { suspenseRecordId },
    config,
  );
  return vo ? adaptSuspenseEntryDetail(vo) : undefined;
}

/**
 * 提交暂记调账（/adjust）。返回提交结果（applyCode / adjustmentId / status）。
 */
export async function submitSuspenseAdjustment(
  form: NewAdjustmentForm,
  config?: ApiRequestConfig,
): Promise<AdjustmentSubmitResult> {
  const vo = await apiClient.post<SuspenseAdjustRespVO>(
    ADJUST_URL,
    buildAdjustPayload(form),
    config,
  );
  return adaptAdjustSubmitResult(vo);
}

/**
 * 调账 / 审批详情（/detail，adjustmentId → 详情）。返回带 adjustmentEntries /
 * offsettingEntryFor 的复合 Domain；后端 data 缺失时返回 undefined。
 */
export async function getSuspenseAdjustmentDetail(
  adjustmentId: number,
  config?: ApiRequestConfig,
): Promise<AdjustedDetailDomain | undefined> {
  const vo = await apiClient.post<SuspenseAdjustmentApprovalDetailVO | null>(
    DETAIL_URL,
    { adjustmentId },
    config,
  );
  return vo ? adaptSuspenseAdjustmentDetail(vo) : undefined;
}

/** 科目下拉 endpoint（reconciliation 域，编辑页选科目用）。 */
const ACCOUNTS_LEAF_URL =
  '/api/finance/v1/finance/reconciliation/tx/accounts/leaf';

/**
 * 查询末级科目（accounts/leaf，按 financeBookId）。
 * 返回 debit / credit 分组科目；后端 data 缺失时返回 undefined。
 */
export async function getTxAccountsLeaf(
  financeBookId: number,
  config?: ApiRequestConfig,
): Promise<LeafAccountsResp | undefined> {
  const data = await apiClient.post<LeafAccountsResp | null>(
    ACCOUNTS_LEAF_URL,
    { financeBookId },
    config,
  );
  return data ?? undefined;
}
