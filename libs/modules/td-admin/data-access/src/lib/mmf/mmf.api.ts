import { apiClient, type ApiRequestConfig } from '@myorg/shared/data-access-api';
import type {
  AccrualApplyReqVO,
  AccrualDetail,
  AccrualListParams,
  AccrualListResponse,
  AccrualRecordItem,
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
  SettlementRecordItem,
  SettlementWalletListParams,
  SettlementWalletRecord,
  StablecoinSearchOption,
} from './mmf.model';

/**
 * mmf API。
 *
 * endpoint base `/api/manage/v1/`（源自 td-manage mmf 模块）。
 * `apiClient` 自动解包 `{ code, message, data }` 信封。
 * 列表 API 注入 `id = String(主键)` 满足 DataTable 契约。
 */

// ── 常量：endpoint URL ──
const ACCRUAL_LIST_URL = '/api/manage/v1/manage/dividend/accrual/record/list';
const ACCRUAL_DETAIL_URL =
  '/api/manage/v1/manage/dividend/accrual/record/detail';
const ACCRUAL_WALLET_RECORDS_URL =
  '/api/manage/v1/manage/dividend/accrual/record/wallet/records';
const ACCRUAL_FUND_LIST_URL =
  '/api/manage/v1/manage/dividend/accrual/record/fund/list';
const ACCRUAL_BATCH_APPLY_LIST_URL =
  '/api/manage/v1/manage/dividend/accrual/record/batch/apply/list';
const ACCRUAL_APPLY_URL =
  '/api/manage/v1/manage/dividend/accrual/record/apply';
const SETTLEMENT_LIST_URL =
  '/api/manage/v1/manage/dividend/settlement/record/list';
const SETTLEMENT_DETAIL_URL =
  '/api/manage/v1/manage/dividend/settlement/record/detail';
const SETTLEMENT_WALLET_RECORDS_URL =
  '/api/manage/v1/manage/dividend/settlement/record/wallet/records';
const SETTLEMENT_RECORD_LIST_URL =
  '/api/manage/v1/manage/dividend/settlement/record/record/list';
const STABLECOIN_SEARCHES_URL =
  '/api/manage/v1/common/stablecoin/enabled/searches';
const BLOCKCHAIN_LIST_URL = '/api/manage/v1/common/blockchain/list';

// ── 中间类型：后端列表行（无 id）──
type AccrualRecordItemApi = Omit<AccrualRecordItem, 'id'>;
type SettlementRecordItemApi = Omit<SettlementRecordItem, 'id'>;
interface ListResponseApi<TRow> {
  page?: ResultPageInfo;
  rows?: TRow[];
}

// ======================================================================
// 列表 API（2 个）
// ======================================================================

/** 计提记录分页列表查询。 */
export async function getAccrualRecordList(
  params: AccrualListParams,
  config?: ApiRequestConfig,
): Promise<AccrualListResponse> {
  const res = await apiClient.post<ListResponseApi<AccrualRecordItemApi>>(
    ACCRUAL_LIST_URL,
    {
      data: params.filters,
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    },
    config,
  );
  return {
    page: res.page,
    rows: (res.rows ?? []).map(
      (r): AccrualRecordItem => ({
        ...r,
        id: String(r.accrualRecordId ?? ''),
      }),
    ),
  };
}

/** 结算记录分页列表查询。 */
export async function getSettlementRecordList(
  params: SettlementListParams,
  config?: ApiRequestConfig,
): Promise<SettlementListResponse> {
  const res = await apiClient.post<ListResponseApi<SettlementRecordItemApi>>(
    SETTLEMENT_LIST_URL,
    {
      data: params.filters,
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    },
    config,
  );
  return {
    page: res.page,
    rows: (res.rows ?? []).map(
      (r): SettlementRecordItem => ({
        ...r,
        id: String(r.settlementId ?? ''),
      }),
    ),
  };
}

// ======================================================================
// 详情 API（2 个）
// ======================================================================

/** 计提详情查询。 */
export async function getAccrualDetail(
  accrualRecordId: number | string,
  config?: ApiRequestConfig,
): Promise<AccrualDetail | undefined> {
  const data = await apiClient.post<AccrualDetail | null>(
    ACCRUAL_DETAIL_URL,
    { accrualRecordId: Number(accrualRecordId) },
    config,
  );
  return data ?? undefined;
}

/** 结算详情查询。 */
export async function getSettlementDetail(
  settlementId: number | string,
  config?: ApiRequestConfig,
): Promise<SettlementDetail | undefined> {
  const data = await apiClient.post<SettlementDetail | null>(
    SETTLEMENT_DETAIL_URL,
    { settlementId: Number(settlementId) },
    config,
  );
  return data ?? undefined;
}

// ======================================================================
// 子查询 API（3 个：钱包明细 + 钱包记录 + 审批记录）
// ======================================================================

/** 计提钱包明细子表格查询。filters 含 walletAddress（筛选）+ billCode（initialValue）。
 *  注入 id=String(accrualTime) 满足子表格 DataTable `{ id: string }` 契约（源 rowKey=accrualTime）。 */
export async function getAccrualWalletRecords(
  params: AccrualWalletListParams,
  config?: ApiRequestConfig,
): Promise<{ page?: ResultPageInfo; rows: AccrualWalletRecord[] }> {
  const res = await apiClient.post<{
    page?: ResultPageInfo;
    rows?: Omit<AccrualWalletRecord, 'id'>[];
  }>(ACCRUAL_WALLET_RECORDS_URL, {
    data: params.filters,
    page: { pageNum: params.pageNum, pageSize: params.pageSize },
  }, config);
  return {
    page: res.page,
    rows: (res.rows ?? []).map(
      (r): AccrualWalletRecord => ({
        ...r,
        id: String(r.accrualTime ?? ''),
      }),
    ),
  };
}

/** 结算钱包记录子表格查询（Tab1）。filters 含 walletAddress + settlementId + status。注入 id=String(accrualDate)。 */
export async function getSettlementWalletRecords(
  params: SettlementWalletListParams,
  config?: ApiRequestConfig,
): Promise<{ page?: ResultPageInfo; rows: SettlementWalletRecord[] }> {
  const res = await apiClient.post<{
    page?: ResultPageInfo;
    rows?: Omit<SettlementWalletRecord, 'id'>[];
  }>(SETTLEMENT_WALLET_RECORDS_URL, {
    data: params.filters,
    page: { pageNum: params.pageNum, pageSize: params.pageSize },
  }, config);
  return {
    page: res.page,
    rows: (res.rows ?? []).map(
      (r): SettlementWalletRecord => ({
        ...r,
        id: String(r.accrualDate ?? ''),
      }),
    ),
  };
}

/** 结算审批记录子表格查询（Tab2）。filters 含 settlementId。注入 id=String(createTime)。 */
export async function getSettlementApprovalRecords(
  params: SettlementApprovalListParams,
  config?: ApiRequestConfig,
): Promise<{ page?: ResultPageInfo; rows: SettlementApprovalRecord[] }> {
  const res = await apiClient.post<{
    page?: ResultPageInfo;
    rows?: Omit<SettlementApprovalRecord, 'id'>[];
  }>(SETTLEMENT_RECORD_LIST_URL, {
    data: params.filters,
    page: { pageNum: params.pageNum, pageSize: params.pageSize },
  }, config);
  return {
    page: res.page,
    rows: (res.rows ?? []).map(
      (r): SettlementApprovalRecord => ({
        ...r,
        id: String(r.createTime ?? ''),
      }),
    ),
  };
}

// ======================================================================
// 基金列表（1 个，accrual + settlement 列表页共用下拉）
// ======================================================================

/** 基金下拉数据源（accrual + settlement 列表页共用）。 */
export function getFundList(
  config?: ApiRequestConfig,
): Promise<FundOption[]> {
  return apiClient.post<FundOption[]>(ACCRUAL_FUND_LIST_URL, {}, config);
}

// ======================================================================
// 批量申报查询（1 个，Modal 内嵌可选静态表格）
// ======================================================================

/** 按基金 + 申请时间范围查询可申报的计提记录列表（非分页）。 */
export function getBatchApplyList(
  params: BatchApplyListParams,
  config?: ApiRequestConfig,
): Promise<BatchApplyListItem[]> {
  return apiClient.post<BatchApplyListItem[]>(
    ACCRUAL_BATCH_APPLY_LIST_URL,
    params,
    config,
  );
}

// ======================================================================
// 申报写入（1 个：apply，批量/单条统一入口）
// ======================================================================

/** 计提申报（批量/单条统一入口）。
 *
 * - 批量：{ applyReqVOList, ruleId, totalAccrualUnits }
 * - 单条：{ applyReqVOList: [ { accrualRecordId, accrualUnits } ] }
 */
export function applyAccrualRecord(
  dto: AccrualApplyReqVO,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(ACCRUAL_APPLY_URL, dto, config);
}

// ======================================================================
// 公共下拉（2 个）
// ======================================================================

/** 查询启用的 stablecoin 下拉。 */
export function getStablecoinSearches(
  config?: ApiRequestConfig,
): Promise<StablecoinSearchOption[]> {
  return apiClient.get<StablecoinSearchOption[]>(
    STABLECOIN_SEARCHES_URL,
    config,
  );
}

/** 查询区块链下拉。 */
export function getBlockchainList(
  config?: ApiRequestConfig,
): Promise<BlockchainOption[]> {
  return apiClient.get<BlockchainOption[]>(BLOCKCHAIN_LIST_URL, config);
}
