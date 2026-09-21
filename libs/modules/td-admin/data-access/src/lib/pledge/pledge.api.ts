import {
  apiClient,
  type ApiRequestConfig,
} from '@myorg/shared/data-access-api';
import type {
  AddAssetCategoryReq,
  AddReserveAssetReq,
  AssetCategoryListQuery,
  AssetCategoryOption,
  AssetTransactionCreateReq,
  BankOption,
  ChangeReserveAssetStatusReq,
  CurrencyOption,
  EditReserveAssetReq,
  OperateRecordQuery,
  OperateRecordResponse,
  PageResult,
  ReserveAssetDetail,
  ReserveAssetDetailReq,
  ReserveAssetListQuery,
  ReserveAssetListResponse,
  ReserveAssetOptionList,
  ReserveAssetTxnListQuery,
  ReserveAssetTxnListResponse,
} from './pledge.model';

/**
 * pledge 模块 API（18 个 endpoint，含下拉数据源）。
 *
 * 死代码 7 个不实现（详见第 8 章）：
 *   1. manage/list             — view.tsx（死代码详情页）独占
 *   2. manage/detail           — view.tsx 独占（新 edit.tsx 半成品 import 但未用）
 *   3. accountOverview         — view.tsx 独占，new-view 已注释
 *   4. tokensOverview          — view.tsx 独占，new-view 已注释
 *   5. stableCoin/info         — pledge.ts 定义但全仓无调用
 *   6. updateReserveAccount    — pledge.ts:49，全仓 grep 无调用
 *   7. updateTransaction       — pledge.ts:86，全仓 grep 无调用
 *
 * 全部 POST 请求（除 currency/bank 为 GET），body.data + page 包裹（后端契约对齐 DataTable*ReqVo）。
 *
 * 约束：
 * - 分页请求体用 pageNum（非 page）。
 * - tx/save 两封装合一，参数以新版 SaveAssentTransactionReqVo 为准（旧版银行字段丢弃）。
 * - bookStatus 透传到 data（后端不存此字段），前端过滤逻辑不下沉到 API 层。
 * - apiClient 自动解包 { code, message, data } 信封。
 */

// ── 常量：endpoint URL ──

const RESERVE_ASSET_LIST_PAGE_URL = '/api/manage/v1/reserve/asset/listPage';
const RESERVE_ASSET_TX_SEARCHES_URL =
  '/api/manage/v1/reserve/asset/manage/tx/searches';
const RESERVE_ASSET_DETAIL_URL = '/api/manage/v1/reserve/asset/detail';
const RESERVE_ASSET_OPERATE_RECORD_URL =
  '/api/manage/v1/reserve/asset/detail/operateRecordListPage';
const RESERVE_ASSET_ADD_URL = '/api/manage/v1/reserve/asset/add';
const RESERVE_ASSET_EDIT_URL = '/api/manage/v1/reserve/asset/edit';
const RESERVE_ASSET_EDIT_STATUS_URL = '/api/manage/v1/reserve/asset/edit/status';
const RESERVE_ASSET_CATEGORY_ADD_URL = '/api/manage/v1/reserve/asset/category/add';
const RESERVE_ASSET_TX_SAVE_URL = '/api/manage/v1/reserve/asset/manage/tx/save';
const RESERVE_ASSET_LIST_URL = '/api/manage/v1/reserve/asset/list';
const RESERVE_ASSET_CATEGORY_LIST_URL =
  '/api/manage/v1/reserve/asset/manage/category/list';
const COMMON_CURRENCY_LIST_URL = '/api/manage/v1/common/currency/list';
const COMMON_BANK_LIST_URL = '/api/manage/v1/common/bank/list';

// ── 列表请求体（data + page 包裹，对齐 DataTable*ReqVo）──

interface ListRequestBody<TFilters> {
  data: TFilters;
  page: { pageNum: number; pageSize: number };
}

/** 提取分页字段 + bookStatus（透传到 data 但不传后端）。 */
function toListBody<T extends { pageNum: number; pageSize: number; bookStatus?: string }>(
  params: T,
): ListRequestBody<Omit<T, 'pageNum' | 'pageSize' | 'bookStatus'>> {
  const { pageNum, pageSize, bookStatus, ...data } = params;
  // bookStatus 是前端推导的伪状态，后端不存此字段，传到 data 供页面层全量拉取逻辑使用。
  // 此处不过滤 bookStatus —— 页面层 query 的 select 做过滤。
  return {
    data: { ...data, bookStatus } as Omit<T, 'pageNum' | 'pageSize' | 'bookStatus'>,
    page: { pageNum, pageSize },
  };
}

/** 提取分页字段（不含 bookStatus）。 */
function toTxListBody<T extends { pageNum: number; pageSize: number }>(
  params: T,
): ListRequestBody<Omit<T, 'pageNum' | 'pageSize'>> {
  const { pageNum, pageSize, ...data } = params;
  return {
    data: data as Omit<T, 'pageNum' | 'pageSize'>,
    page: { pageNum, pageSize },
  };
}

/** operateType 为 0 时转空串 ''（后端约定）。 */
function toOperateRecordBody(
  params: OperateRecordQuery,
): ListRequestBody<Omit<OperateRecordQuery, 'pageNum' | 'pageSize'>> {
  const { pageNum, pageSize, operateType, ...rest } = params;
  return {
    data: {
      ...rest,
      operateType: operateType === 0 ? ('' as unknown as number) : operateType,
    },
    page: { pageNum, pageSize },
  };
}

// ======================================================================
// 3.1 列表 API（2 个）
// ======================================================================

/**
 * 储备资产分页列表。
 * POST /reserve/asset/listPage
 *
 * bookStatus 透传到 data（前端过滤不下沉到 API 层）。
 * 调用方：reserve-asset-list/index.tsx
 */
export async function getReserveAssetListPage(
  params: ReserveAssetListQuery,
  config?: ApiRequestConfig,
): Promise<ReserveAssetListResponse> {
  // bookStatus 传到 data 但后端不认识此字段——页面层用 customFetch/select 做全量拉取+前端过滤
  const body = toListBody(params);
  const res = await apiClient.post<PageResult<unknown>>(
    RESERVE_ASSET_LIST_PAGE_URL,
    body,
    config,
  );
  return {
    page: res.page,
    rows: (res.rows ?? []) as ReserveAssetListResponse['rows'],
  };
}

/**
 * 储备资产交易分页列表。
 * POST /reserve/asset/manage/tx/searches
 *
 * 调用方：asset-transaction/index.tsx（列表页）、view-asset-transactions.tsx（详情 Tab）
 */
export async function getReserveAssetTxList(
  params: ReserveAssetTxnListQuery,
  config?: ApiRequestConfig,
): Promise<ReserveAssetTxnListResponse> {
  const body = toTxListBody(params);
  const res = await apiClient.post<PageResult<unknown>>(
    RESERVE_ASSET_TX_SEARCHES_URL,
    body,
    config,
  );
  return {
    page: res.page,
    rows: (res.rows ?? []) as ReserveAssetTxnListResponse['rows'],
  };
}

// ======================================================================
// 3.2 详情 API（2 个）
// ======================================================================

/**
 * 储备资产详情。
 * POST /reserve/asset/detail
 *
 * 调用方：new-view.tsx（详情页主数据）
 */
export async function getReserveAssetDetail(
  params: ReserveAssetDetailReq,
  config?: ApiRequestConfig,
): Promise<ReserveAssetDetail> {
  return apiClient.post<ReserveAssetDetail>(
    RESERVE_ASSET_DETAIL_URL,
    params,
    config,
  );
}

/**
 * 操作记录分页列表（详情页 Operation Records Tab）。
 * POST /reserve/asset/detail/operateRecordListPage
 *
 * 调用方：view-operation-records.tsx
 * operateType = 0 时转空串 ''（后端约定）。
 */
export async function getOperateRecordListPage(
  params: OperateRecordQuery,
  config?: ApiRequestConfig,
): Promise<OperateRecordResponse> {
  const body = toOperateRecordBody(params);
  const res = await apiClient.post<PageResult<unknown>>(
    RESERVE_ASSET_OPERATE_RECORD_URL,
    body,
    config,
  );
  return {
    page: res.page,
    rows: (res.rows ?? []) as OperateRecordResponse['rows'],
  };
}

// ======================================================================
// 3.3 写操作 API（6 个）
// ======================================================================

/**
 * 新增储备资产。
 * POST /reserve/asset/add
 *
 * 调用方：reserve-asset-list/index.tsx → onFinish('new')
 */
export async function addReserveAsset(
  params: AddReserveAssetReq,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(RESERVE_ASSET_ADD_URL, params, config);
}

/**
 * 编辑储备资产（资产类别）。
 * POST /reserve/asset/edit
 *
 * 调用方：reserve-asset-list/index.tsx → onFinish('edit')
 */
export async function editReserveAsset(
  params: EditReserveAssetReq,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(RESERVE_ASSET_EDIT_URL, params, config);
}

/**
 * 启用/停用储备资产。
 * POST /reserve/asset/edit/status
 *
 * 调用方：reserve-asset-list/index.tsx → actionClick(Deactivate→50 / Activate→20)
 */
export async function changeReserveAssetStatus(
  params: ChangeReserveAssetStatusReq,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(RESERVE_ASSET_EDIT_STATUS_URL, params, config);
}

/**
 * 新增资产类别。
 * POST /reserve/asset/category/add
 *
 * 调用方：asset-ategory.tsx（新增资产类别页）
 */
export async function addAssetCategory(
  params: AddAssetCategoryReq,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(RESERVE_ASSET_CATEGORY_ADD_URL, params, config);
}

/**
 * 新建储备资产交易（两封装合一，参数以新版 SaveAssentTransactionReqVo 为准）。
 * POST /reserve/asset/manage/tx/save
 *
 * 旧版 reserveNewTransactionApi 的 correspondentBank / counterparty 等银行字段已丢弃。
 * 调用方：asset-transaction/edit.tsx（新版新建交易页）
 */
export async function saveReserveAssetTx(
  params: AssetTransactionCreateReq,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(RESERVE_ASSET_TX_SAVE_URL, params, config);
}

// ======================================================================
// 3.4 下拉/子查询 API（6 个）
// ======================================================================

/**
 * 储备资产列表（下拉选项，无分页）。
 * POST /reserve/asset/list
 *
 * 调用方：asset-transaction/edit.tsx（新建交易页的下拉选项源）
 */
export async function getReserveAssetOptions(
  config?: ApiRequestConfig,
): Promise<ReserveAssetOptionList> {
  return apiClient.post<ReserveAssetOptionList>(
    RESERVE_ASSET_LIST_URL,
    {},
    config,
  );
}

/**
 * 资产类别下拉列表。
 * POST /reserve/asset/manage/category/list
 *
 * 参数 reserveAccountId + state（新增交易页 state=1 仅启用的类别）。
 * 调用方：asset-transaction/index.tsx、asset-transaction/edit.tsx、
 *        reserve-asset-list/index.tsx、view-asset-transactions.tsx（4 处）
 */
export async function getAssetCategoryList(
  params: AssetCategoryListQuery,
  config?: ApiRequestConfig,
): Promise<AssetCategoryOption[]> {
  return apiClient.post<AssetCategoryOption[]>(
    RESERVE_ASSET_CATEGORY_LIST_URL,
    params,
    config,
  );
}

/**
 * Currency 下拉列表。
 * GET /common/currency/list
 *
 * 调用方：asset-transaction/index.tsx、reserve-asset-list/index.tsx
 */
export async function getCurrencyList(
  config?: ApiRequestConfig,
): Promise<CurrencyOption[]> {
  return apiClient.get<CurrencyOption[]>(COMMON_CURRENCY_LIST_URL, config);
}

/**
 * Bank 下拉列表。
 * GET /common/bank/list
 *
 * 调用方：reserve-asset-list/index.tsx（bankId 筛选项已被注释，但与 currency/bank 下拉仍 import）
 */
export async function getBankList(
  config?: ApiRequestConfig,
): Promise<BankOption[]> {
  return apiClient.get<BankOption[]>(COMMON_BANK_LIST_URL, config);
}
