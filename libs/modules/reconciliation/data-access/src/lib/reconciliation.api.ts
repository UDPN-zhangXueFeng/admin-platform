/**
 * Reconciliation 模块 API（real-time + reserve 双子域，13 端点）。
 *
 * 迁移自 td-manage `src/lib/components/reconciliation/{real-time,reserve}/api.ts`。
 *
 * ## 前缀规则
 * - 全部为**静态全路径**字符串 `/api/finance/v1/finance/reconciliation/<domain>/<action>`，
 *   无 `${CONFIG_ID}` 模板段（finance 域，对齐 tokenized-deposit 的
 *   `/api/finance/v1/finance/book/by-reserve` 同前缀）。
 * - `apiClient` 自动解包 `{ code, message, data }` 信封并在 code !== 0 时抛错。
 * - baseURL 由 `axiosClient` 的 `NEXT_PUBLIC_API_BASE_URL`（=/aps）兜底拼接。
 *
 * ## 请求体契约
 * 列表 POST 用 `{ data: filters, page: { pageNum, pageSize } }` 包裹结构。
 * 列表行注入字符串 `id` 满足 DataTable `{ id: string }` 契约（journal 模式）。
 *
 * ## 跨域复用
 * reserve 的 `ReservePostToSuspenseModal` 复用 Token 域 `accounts/leaf` 接口
 * （入参 financeBookId），故 `getLeafAccounts` 置于本共享层。
 *
 * ## 后端端点缺口（R1）
 * `reserve/post-suspense` 后端端点尚未生成（旧 api.ts 注释明示，mock 顶位）。
 * 本文件保留 `postReserveSuspense` 函数；feature 层以 feature-flag 隐藏挂账入口，
 * 待后端就绪后移除 flag。
 */

import {
  apiClient,
  type ApiRequestConfig,
} from '@myorg/shared/data-access-api';
import type {
  LeafAccountsReqVo,
  LeafAccountsRespVo,
  PostSuspenseReqVo,
  PostSuspenseRespVo,
  ReconciliationListParams,
  ReconciliationListResponse,
  ReserveAssetBasicDetailReqVo,
  ReserveAssetBasicDetailRespVo,
  ReserveAssetListReqVo,
  ReserveAssetSummaryRespVo,
  ReservePostSuspenseReqVo,
  ReserveReconDetailRespVo,
  ReserveReconListReqVo,
  ReserveReconLogReqVo,
  ReserveReconLogRespVo,
  TokenReconBasicDetailReqVo,
  TokenReconBasicDetailRespVo,
  TokenReconListReqVo,
  TokenReconSummaryRespVo,
  TxReconDetailRespVo,
  TxReconListReqVo,
  TxReconLogReqVo,
  TxReconLogRespVo,
} from './reconciliation.model';

// ── Real-time (Token) 域 URL ───────────────────────────────────────────────────

const TOKEN_LIST_URL =
  '/api/finance/v1/finance/reconciliation/tx/token-list';
const TOKEN_BASIC_DETAIL_URL =
  '/api/finance/v1/finance/reconciliation/tx/token-basic-detail';
const TX_LIST_URL = '/api/finance/v1/finance/reconciliation/tx/list';
const TX_INVESTIGATION_LIST_URL =
  '/api/finance/v1/finance/reconciliation/tx/investigation-list';
const TX_RECON_LOG_URL =
  '/api/finance/v1/finance/reconciliation/tx/recon-log';
const ACCOUNTS_LEAF_URL =
  '/api/finance/v1/finance/reconciliation/tx/accounts/leaf';
const TX_POST_SUSPENSE_URL =
  '/api/finance/v1/finance/reconciliation/tx/post-suspense';

// ── Reserve 域 URL ──────────────────────────────────────────────────────────────

const RESERVE_ASSET_LIST_URL =
  '/api/finance/v1/finance/reconciliation/reserve/asset-list';
const RESERVE_BASIC_DETAIL_URL =
  '/api/finance/v1/finance/reconciliation/reserve/asset-basic-detail';
const RESERVE_LIST_URL =
  '/api/finance/v1/finance/reconciliation/reserve/list';
const RESERVE_INVESTIGATION_LIST_URL =
  '/api/finance/v1/finance/reconciliation/reserve/investigation-list';
const RESERVE_RECON_LOG_URL =
  '/api/finance/v1/finance/reconciliation/reserve/recon-log';
const RESERVE_POST_SUSPENSE_URL =
  '/api/finance/v1/finance/reconciliation/reserve/post-suspense';

/** 列表请求体壳（后端 `{ data, page }` 包裹）。 */
interface ListRequestBody<TFilters> {
  data: TFilters;
  page: { pageNum: number; pageSize: number };
}

/** 列表响应内部类型（rows 无 id，注入前）。 */
interface ListApi<R> {
  page?: { pageNum?: number; pageSize?: number; total?: number; pages?: number };
  rows?: Omit<R, 'id'>[];
}

/**
 * POST 列表通用包装：构造 `{ data: filters, page }` 请求体，返回前为每行注入
 * 字符串 `id`。服务端分页用 **pageNum**（finance 域后端惯例）。
 */
async function postList<
  R extends { id: string },
  F,
>(
  url: string,
  params: ReconciliationListParams<F>,
  idSelector: (row: Omit<R, 'id'>) => string,
  config?: ApiRequestConfig,
): Promise<ReconciliationListResponse<R>> {
  const response = await apiClient.post<ListApi<R>, ListRequestBody<F>>(
    url,
    {
      data: params.filters,
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    },
    config,
  );
  return {
    page: response.page,
    rows: (response.rows ?? []).map((row): R => ({
      ...(row as R),
      id: idSelector(row),
    })),
  };
}

// ── Real-time 列表 ──────────────────────────────────────────────────────────────

/** Token 对账汇总列表（real-time 列表页，rowKey=tokenId）。 */
export function getTokenList(
  params: ReconciliationListParams<TokenReconListReqVo>,
  config?: ApiRequestConfig,
): Promise<ReconciliationListResponse<TokenReconSummaryRespVo>> {
  return postList(TOKEN_LIST_URL, params, (row) => String(row.tokenId), config);
}

/** Tx 明细列表（real-time 详情页 Reconciliation List Tab，rowKey=reconciliationTxId）。 */
export function getTxList(
  params: ReconciliationListParams<TxReconListReqVo>,
  config?: ApiRequestConfig,
): Promise<ReconciliationListResponse<TxReconDetailRespVo>> {
  return postList(TX_LIST_URL, params, (row) => String(row.reconciliationTxId), config);
}

/**
 * Tx investigation 列表（real-time 详情页 Investigation Tab，rowKey=reconciliationTxId）。
 * 后端返回全集，前端二次过滤 `reconciliationStatus===3` 在 query 层 select 处理（R2）。
 */
export function getTxInvestigationList(
  params: ReconciliationListParams<TxReconListReqVo>,
  config?: ApiRequestConfig,
): Promise<ReconciliationListResponse<TxReconDetailRespVo>> {
  return postList(TX_INVESTIGATION_LIST_URL, params, (row) => String(row.reconciliationTxId), config);
}

// ── Real-time 单对象 ────────────────────────────────────────────────────────────

/** Token 基本信息（real-time 详情页顶部 9 格 KV）。 */
export function getTokenBasicDetail(
  params: TokenReconBasicDetailReqVo,
  config?: ApiRequestConfig,
): Promise<TokenReconBasicDetailRespVo> {
  return apiClient.post<TokenReconBasicDetailRespVo>(
    TOKEN_BASIC_DETAIL_URL,
    params,
    config,
  );
}

/** Tx 对账日志（ReconLogModal / PostToSuspenseModal 回显）。 */
export function getTxReconLog(
  params: TxReconLogReqVo,
  config?: ApiRequestConfig,
): Promise<TxReconLogRespVo> {
  return apiClient.post<TxReconLogRespVo>(TX_RECON_LOG_URL, params, config);
}

// ── 跨域共享（末级科目，reserve ReservePostToSuspenseModal 也调） ──────────────

export function getLeafAccounts(
  params: LeafAccountsReqVo,
  config?: ApiRequestConfig,
): Promise<LeafAccountsRespVo> {
  return apiClient.post<LeafAccountsRespVo>(ACCOUNTS_LEAF_URL, params, config);
}

// ── Real-time 挂账 ───────────────────────────────────────────────────────────────

/** real-time 挂账提交（端点已存在）。 */
export function postTokenSuspense(
  params: PostSuspenseReqVo,
  config?: ApiRequestConfig,
): Promise<PostSuspenseRespVo> {
  return apiClient.post<PostSuspenseRespVo>(
    TX_POST_SUSPENSE_URL,
    params,
    config,
  );
}

// ── Reserve 列表 ─────────────────────────────────────────────────────────────────

/** 储备资产汇总列表（reserve 列表页，rowKey=reserveAccountId）。 */
export function getReserveAssetList(
  params: ReconciliationListParams<ReserveAssetListReqVo>,
  config?: ApiRequestConfig,
): Promise<ReconciliationListResponse<ReserveAssetSummaryRespVo>> {
  return postList(RESERVE_ASSET_LIST_URL, params, (row) => String(row.reserveAccountId), config);
}

/** Reserve 明细列表（reserve 详情页 Reconciliation List Tab，rowKey=reconciliationReserveId）。 */
export function getReserveList(
  params: ReconciliationListParams<ReserveReconListReqVo>,
  config?: ApiRequestConfig,
): Promise<ReconciliationListResponse<ReserveReconDetailRespVo>> {
  return postList(RESERVE_LIST_URL, params, (row) => String(row.reconciliationReserveId), config);
}

/**
 * Reserve investigation 列表（reserve 详情页 Investigation Tab）。
 * 与 real-time 不同：reserve **不在前端二次过滤**，直接展示后端返回（R2 语义分叉）。
 */
export function getReserveInvestigationList(
  params: ReconciliationListParams<ReserveReconListReqVo>,
  config?: ApiRequestConfig,
): Promise<ReconciliationListResponse<ReserveReconDetailRespVo>> {
  return postList(RESERVE_INVESTIGATION_LIST_URL, params, (row) => String(row.reconciliationReserveId), config);
}

// ── Reserve 单对象 ──────────────────────────────────────────────────────────────

/** 储备资产基本信息（reserve 详情页顶部 KV）。 */
export function getReserveBasicDetail(
  params: ReserveAssetBasicDetailReqVo,
  config?: ApiRequestConfig,
): Promise<ReserveAssetBasicDetailRespVo> {
  return apiClient.post<ReserveAssetBasicDetailRespVo>(
    RESERVE_BASIC_DETAIL_URL,
    params,
    config,
  );
}

/** Reserve 对账日志（ReserveReconLogModal / ReservePostToSuspenseModal 回显）。 */
export function getReserveReconLog(
  params: ReserveReconLogReqVo,
  config?: ApiRequestConfig,
): Promise<ReserveReconLogRespVo> {
  return apiClient.post<ReserveReconLogRespVo>(
    RESERVE_RECON_LOG_URL,
    params,
    config,
  );
}

// ── Reserve 挂账（后端端点缺失 R1；feature-flag 隐藏，函数保留待后端就绪） ──────────

/**
 * reserve 挂账提交。后端端点尚未生成（旧 api.ts 注释明示）。
 * feature 层以 feature-flag 隐藏挂账入口；待后端就绪后移除 flag 即可启用。
 */
export function postReserveSuspense(
  params: ReservePostSuspenseReqVo,
  config?: ApiRequestConfig,
): Promise<{ code: number; message?: string }> {
  return apiClient.post<{ code: number; message?: string }>(
    RESERVE_POST_SUSPENSE_URL,
    params,
    config,
  );
}
