/**
 * tokenized-deposit 模块 API（41 个唯一 endpoint）。
 *
 * 来源：td-manage 4 个 api 模块（common / stablecoin / stablecoin-manage /
 * stablecoin-settings）+ typings 自动生成的 6 个动态/GET endpoint。
 *
 * ## 去重 + 去误导命名（文档第 3 章硬约束）
 *
 * 历史 api 模块函数名与真实 endpoint 严重不一致，本文件**以 endpoint 为准去重**：
 * 1. `/td/apply/add` → `createTDApply`（源 typings tdApplyAddApi；忽略 stablecoin-manage
 *    的 `saveStablecoinPriceApi`，其命名指向 price 模块，属误导）。
 * 2. `/td/operation/edit` → `editTDOperation`（源 typings tdOperationEditApi；忽略
 *    `updateStablecoinPriceApi` 同样误导）。
 * 3. `/td/operation/enable` → `updateTDStatus(code, enable)`（合并 stablecoin.ts
 *    `updateStatusApi` 与 stablecoin-manage.ts `statusUpdateApi`，两者同 endpoint）。
 * 4. `/util/wallet/keystore` → `generateWalletKeystore`（合并 common.ts
 *    `getWalletKeystoreApi` 与 typings `utilWalletKeystoreApi`），body 按 storageType
 *    分支（keystore / rigsec）。
 * 5. 2 个动态 URL：`getTDOperationEditDetail(code)` GET `/td/operation/edit/detail/${code}`；
 *    `getFinanceBookByReserve(reserveAccountId)` GET `/finance/v1/finance/book/by-reserve/${reserveAccountId}`。
 *
 * ## 请求体契约（td 域后端）
 *
 * 列表 POST 请求体使用 `{ page: { pageNum, pageSize }, data: {...filters} }` 包裹结构
 * （对齐 td-manage useCustomTable + admin-platform sp-access 同域实证）。`apiClient`
 * 自动解包 `{ code, message, data }` 信封。列表 API 注入字符串 `id`（= String(主键)）
 * 满足 DataTable `{ id: string }` 契约。分页字段 `pageNum`（非 page）。
 *
 * ## AES 钱包加密
 *
 * 管理员钱包 password 经 `getEncryptionData`（AES-CBC）加密后提交，由调用方在提交前
 * 完成（见 useTokenizedDepositSubmit / useWalletManagement hook）。`generateWalletKeystore`
 * 的 keystore 分支内部加密 password（贴合源 `getWalletKeystoreApi` 直传 + 调用方加密，
 * rigsec 分支不传 password）。
 *
 * ## Mock（3 个，保留）
 *
 * `getRoleWalletsList` / `getRoleWalletDetail` / `configureRoleWallet` 后端未实装，
 * 保留 mock（setTimeout + 本地 generateMockRoleWallets）。
 */

import {
  apiClient,
  type ApiRequestConfig,
} from '@myorg/shared/data-access-api';
import { getEncryptionData } from '@myorg/modules/tokenized-deposit/util';
import type {
  AdminWalletListItem,
  AdminWalletListParams,
  ApiResponse,
  ApplyListItem,
  BlockchainOption,
  CommonBlockchainListParams,
  ContractDetailItem,
  ContractDetailListParams,
  ContractDetailListResponse,
  ContractPackageItem,
  ContractPackageListParams,
  ContractPackageListResponse,
  CurrencyOption,
  DeployHistoryItem,
  DeployStepDetail,
  DeployStepDetailParams,
  FinanceBookByReserveParams,
  FinanceBookInfo,
  FinanceTemplateListParams,
  FinanceTemplateOption,
  KeyServiceListParams,
  KeyServiceOption,
  MMFSummaryItem,
  MMFSummaryListParams,
  MMFSummaryListResponse,
  OperationRecordItem,
  OperationRecordListParams,
  OperationRecordListResponse,
  PaginatedResponse,
  ReserveAccountOption,
  ReserveBalance,
  ReserveBalanceParams,
  ReserveListParams,
  RoleWalletItem,
  RoleWalletListParams,
  RoleWalletListResponse,
  SmartContractOption,
  SPRecordItem,
  SPRecordListParams,
  SPRecordListResponse,
  StablecoinInfo,
  StablecoinRecordListParams,
  TDRecordItem,
  TDRecordListParams,
  TDRecordListResponse,
  TDEditDetail,
  TimezoneOption,
  TokenTypeOption,
  WalletDetailItem,
  WalletDetailListResponse,
  WalletDetailParams,
  WalletItem,
  WalletListParams,
  WalletListResponse,
  GenerateWalletResult,
} from './tokenized-deposit.model';

// ── 常量：endpoint URL ──

// 列表 / 分页（td / transaction 域）
const TD_RECORD_LIST_URL = '/api/manage/v1/td/manage/searches/record';
const SP_RECORD_LIST_URL = '/api/manage/v1/transaction/getDirectMintingTxList';
const WALLET_LIST_URL = '/api/manage/v1/td/wallet/listPage';
const WALLET_BALANCE_URL = '/api/manage/v1/td/wallet/balance';
const WALLET_DETAIL_URL = '/api/manage/v1/td/wallet/detail';
const WALLET_HISTORY_URL = '/api/manage/v1/td/wallet/history';
const OPERATION_RECORD_LIST_URL = '/api/manage/v1/td/records/listPage';
const MMF_SUMMARY_LIST_URL = '/api/manage/v1/td/mmf/summary/listPage';
const STABLECOIN_RECORD_LIST_URL = '/api/manage/v1/stablecoin/record/query';

// 公共下拉（common 域，GET）
const COMMON_BLOCKCHAIN_LIST_URL = '/api/manage/v1/common/blockchain/list';
const COMMON_CURRENCY_LIST_URL = '/api/manage/v1/common/currency/list';
const COMMON_TOKEN_TYPE_LIST_URL = '/api/manage/v1/common/tokenType/list';
const COMMON_TIMEZONE_LIST_URL = '/api/manage/v1/common/timezone/list';

// 标题 / 详情 / 子查询
const TD_APPLY_LIST_URL = '/api/manage/v1/td/apply/list';
const STABLECOIN_LIST_URL = '/api/manage/v1/stablecoin/list';
const STABLECOIN_GET_URL = '/api/manage/v1/stablecoin/get';
const CONTRACT_LATEST_INFO_URL = '/api/manage/v1/td/contract/latestInfo';
const CONTRACT_DETAIL_URL = '/api/manage/v1/td/contract/detail';
const CONTRACT_DEPLOY_HISTORY_URL = '/api/manage/v1/td/contract/deploy/history';
const CONTRACT_DEPLOY_STEP_DETAIL_URL =
  '/api/manage/v1/td/contract/deploy/stepDetail';
const RESERVE_BALANCE_URL = '/api/manage/v1/td/manage/reserve/balance';
const SEARCH_PENDING_MELT_URL = '/api/manage/v1/td/manage/search/pending/melt';
const RESERVE_LIST_URL = '/api/manage/v1/td/apply/reserve/list';

// 写操作
const TD_APPLY_ADD_URL = '/api/manage/v1/td/apply/add';
const TD_OPERATION_EDIT_URL = '/api/manage/v1/td/operation/edit';
const MINT_MELT_URL = '/api/manage/v1/td/manage/add/mint/melt';
const STABLECOIN_ISSUE_URL = '/api/manage/v1/stablecoin/issue';
const STABLECOIN_REMOVE_URL = '/api/manage/v1/stablecoin/remove';
const CONTRACT_DEPLOY_URL = '/api/manage/v1/td/contract/deploy';
const TD_OPERATION_ENABLE_URL = '/api/manage/v1/td/operation/enable';
const TD_OPERATION_DELETE_URL = '/api/manage/v1/td/operation/delete';
const WALLET_UPDATE_URL = '/api/manage/v1/td/wallet/update';
const WALLET_APPROVAL_URL = '/api/manage/v1/td/wallet/approval';
const WALLET_MODIFICATION_RECORD_URL =
  '/api/manage/v1/td/wallet/geModificationRecord';
const WALLET_KEYSTORE_URL = '/api/manage/v1/util/wallet/keystore';
const COMMON_CONTRACT_NEW_DEPLOYMENT_URL =
  '/api/manage/v1/common/contract/getNewDeployment';

// 编辑页专属子查询
const KEY_SERVICE_LIST_URL = '/api/manage/v1/td/apply/key/service/list';
const ADMIN_WALLET_LIST_URL = '/api/manage/v1/td/apply/admin/wallet/list';
const FINANCE_TEMPLATE_LIST_URL = '/api/finance/v1/finance/template/list';

// ── 中间类型：后端列表行（无 id）──

type TDRecordItemApi = Omit<TDRecordItem, 'id'>;
type SPRecordItemApi = Omit<SPRecordItem, 'id'>;
type WalletItemApi = Omit<WalletItem, 'id'>;
type OperationRecordItemApi = Omit<OperationRecordItem, 'id'>;
type MMFSummaryItemApi = Omit<MMFSummaryItem, 'id'>;
type ContractPackageItemApi = Omit<ContractPackageItem, 'id'>;
type ContractDetailItemApi = Omit<ContractDetailItem, 'id'>;
type WalletDetailItemApi = Omit<WalletDetailItem, 'id'>;
type DeployHistoryItemApi = Omit<DeployHistoryItem, 'id'>;
type ApplyListItemApi = Omit<ApplyListItem, 'id'>;
type AdminWalletListItemApi = Omit<AdminWalletListItem, 'id'>;
type RoleWalletItemApi = Omit<RoleWalletItem, 'id'>;

/** 后端列表响应（无 id，含分页元信息）。 */
interface ListResponseApi<TRow> {
  page?: { total?: number; pageNum?: number; pageSize?: number; pages?: number };
  rows?: TRow[];
}

/** 列表请求体（td 域后端契约：data + page 包裹，对齐 sp-access 实证）。 */
interface ListRequestBody<TFilters> {
  data: TFilters;
  page: { pageNum: number; pageSize: number };
}

/**
 * 将后端列表响应（{ page, rows } 无 id）映射为 model.ts 的
 * `PaginatedResponse<T>`（{ page, rows } 注入 id），并为每行注入 DataTable 契约 id。
 */
function mapPaginated<TRowApi, TRow extends { id: string }>(
  res: ListResponseApi<TRowApi>,
  getId: (row: TRowApi) => string | number | undefined,
  fallbackIndex = true,
): PaginatedResponse<TRow> {
  return {
    page: {
      total: res.page?.total,
      pageNum: res.page?.pageNum,
      pageSize: res.page?.pageSize,
      pages: res.page?.pages,
    },
    rows: (res.rows ?? []).map(
      (r, index): TRow =>
        ({
          ...(r as object),
          id: String(getId(r) ?? (fallbackIndex ? index : '')),
        }) as TRow,
    ),
  };
}

// ═══════════════════════════════════════════════════════════════════
// 1. 列表 / 分页查询 API（12 个）
// ═══════════════════════════════════════════════════════════════════

/**
 * 铸销记录分页列表（质押铸造，mintMethod=1 + pledgeType=1）。
 * initialValues: stablecoinCode。rowKey: recordId。
 */
export async function getTDRecordList(
  params: TDRecordListParams,
  config?: ApiRequestConfig,
): Promise<TDRecordListResponse> {
  const { pageNum, pageSize, stablecoinCode } = params;
  const res = await apiClient.post<
    ListResponseApi<TDRecordItemApi>,
    ListRequestBody<{ stablecoinCode?: string }>
  >(
    TD_RECORD_LIST_URL,
    {
      data: { stablecoinCode },
      page: { pageNum, pageSize },
    },
    config,
  );
  return mapPaginated<TDRecordItemApi, TDRecordItem>(res, (r) => r.recordId);
}

/**
 * SP 直铸记录分页列表（mintMethod=20 + pledgeType=0）。
 * initialValues: stablecoinId。rowKey: orderNumber。
 */
export async function getSPRecordList(
  params: SPRecordListParams,
  config?: ApiRequestConfig,
): Promise<SPRecordListResponse> {
  const { pageNum, pageSize, stablecoinId } = params;
  const res = await apiClient.post<
    ListResponseApi<SPRecordItemApi>,
    ListRequestBody<{ stablecoinId?: string }>
  >(
    SP_RECORD_LIST_URL,
    {
      data: { stablecoinId },
      page: { pageNum, pageSize },
    },
    config,
  );
  return mapPaginated<SPRecordItemApi, SPRecordItem>(res, (r) => r.orderNumber);
}

/**
 * 钱包列表（默认走 listPage）。
 * 刷新按钮触发的 balance 场景请用 {@link getWalletBalanceList}。
 * rowKey: accountId。
 */
export async function getWalletList(
  params: WalletListParams,
  config?: ApiRequestConfig,
): Promise<WalletListResponse> {
  const { pageNum, pageSize, stablecoinCode } = params;
  const res = await apiClient.post<
    ListResponseApi<WalletItemApi>,
    ListRequestBody<{ stablecoinCode?: string }>
  >(
    WALLET_LIST_URL,
    {
      data: { stablecoinCode },
      page: { pageNum, pageSize },
    },
    config,
  );
  return mapPaginated<WalletItemApi, WalletItem>(res, (r) => r.accountId);
}

/**
 * 钱包余额列表（index Tab3 刷新按钮触发 isOnclick=true 时走此 endpoint）。
 * 与 {@link getWalletList} 同响应结构，仅 endpoint 不同。
 */
export async function getWalletBalanceList(
  params: WalletListParams,
  config?: ApiRequestConfig,
): Promise<WalletListResponse> {
  const { pageNum, pageSize, stablecoinCode } = params;
  const res = await apiClient.post<
    ListResponseApi<WalletItemApi>,
    ListRequestBody<{ stablecoinCode?: string }>
  >(
    WALLET_BALANCE_URL,
    {
      data: { stablecoinCode },
      page: { pageNum, pageSize },
    },
    config,
  );
  return mapPaginated<WalletItemApi, WalletItem>(res, (r) => r.accountId);
}

/**
 * 钱包详情列表（管理钱包 Modal - Details 态）。
 * rowKey: recordId。
 */
export async function getWalletDetailList(
  params: WalletDetailParams,
  config?: ApiRequestConfig,
): Promise<WalletDetailListResponse> {
  const { pageNum, pageSize, stablecoinId, accountType } = params;
  const res = await apiClient.post<
    ListResponseApi<WalletDetailItemApi>,
    ListRequestBody<{ stablecoinId?: number; accountType?: number }>
  >(
    WALLET_DETAIL_URL,
    {
      data: { stablecoinId, accountType },
      page: { pageNum, pageSize },
    },
    config,
  );
  return mapPaginated<WalletDetailItemApi, WalletDetailItem>(
    res,
    (r) => r.recordId,
  );
}

/**
 * 钱包历史列表（管理钱包 Modal - History 态）。
 * rowKey: recordId。
 */
export async function getWalletHistoryList(
  params: WalletDetailParams,
  config?: ApiRequestConfig,
): Promise<WalletDetailListResponse> {
  const { pageNum, pageSize, stablecoinId, accountType } = params;
  const res = await apiClient.post<
    ListResponseApi<WalletDetailItemApi>,
    ListRequestBody<{ stablecoinId?: number; accountType?: number }>
  >(
    WALLET_HISTORY_URL,
    {
      data: { stablecoinId, accountType },
      page: { pageNum, pageSize },
    },
    config,
  );
  return mapPaginated<WalletDetailItemApi, WalletDetailItem>(
    res,
    (r) => r.recordId,
  );
}

/**
 * 操作记录分页列表（index Tab4）。
 * initialValues: stablecoinCode。rowKey: recordId。
 */
export async function getOperationRecordList(
  params: OperationRecordListParams,
  config?: ApiRequestConfig,
): Promise<OperationRecordListResponse> {
  const { pageNum, pageSize, stablecoinCode } = params;
  const res = await apiClient.post<
    ListResponseApi<OperationRecordItemApi>,
    ListRequestBody<{ stablecoinCode?: string }>
  >(
    OPERATION_RECORD_LIST_URL,
    {
      data: { stablecoinCode },
      page: { pageNum, pageSize },
    },
    config,
  );
  return mapPaginated<OperationRecordItemApi, OperationRecordItem>(
    res,
    (r) => r.recordId,
  );
}

/**
 * MMF 基金汇总分页列表（index Tab1 MMF 分支，summary 组件）。
 * initialValues: tokenCode。rowKey: walletTypeCode。
 */
export async function getMMFSummaryList(
  params: MMFSummaryListParams,
  config?: ApiRequestConfig,
): Promise<MMFSummaryListResponse> {
  const { pageNum, pageSize, tokenCode } = params;
  const res = await apiClient.post<
    ListResponseApi<MMFSummaryItemApi>,
    ListRequestBody<{ tokenCode?: string }>
  >(
    MMF_SUMMARY_LIST_URL,
    {
      data: { tokenCode },
      page: { pageNum, pageSize },
    },
    config,
  );
  return mapPaginated<MMFSummaryItemApi, MMFSummaryItem>(
    res,
    (r) => r.walletTypeCode,
  );
}

/**
 * 稳定币铸销记录分页列表（view 页 Tab1）。
 * initialValues: txHash。
 */
export async function getStablecoinRecordList(
  params: StablecoinRecordListParams,
  config?: ApiRequestConfig,
): Promise<PaginatedResponse<TDRecordItem>> {
  const { pageNum, pageSize, txHash } = params;
  const res = await apiClient.post<
    ListResponseApi<TDRecordItemApi>,
    ListRequestBody<{ txHash?: string }>
  >(
    STABLECOIN_RECORD_LIST_URL,
    {
      data: { txHash },
      page: { pageNum, pageSize },
    },
    config,
  );
  return mapPaginated<TDRecordItemApi, TDRecordItem>(res, (r) => r.recordId);
}

/**
 * 区块链下拉（edit 页 useSWR，GET）。
 * { key, value, status }，status===1 可选。
 */
export function getBlockchainOptions(
  _params?: CommonBlockchainListParams,
  config?: ApiRequestConfig,
): Promise<BlockchainOption[]> {
  return apiClient.get<BlockchainOption[]>(COMMON_BLOCKCHAIN_LIST_URL, config);
}

/**
 * 币种下拉（edit 页 useSWR，GET）。
 * { key, value }。
 */
export function getCurrencyOptions(
  config?: ApiRequestConfig,
): Promise<CurrencyOption[]> {
  return apiClient.get<CurrencyOption[]>(COMMON_CURRENCY_LIST_URL, config);
}

/**
 * Token 类型下拉（useTokenTypeOptions hook，GET）。
 * status===0 时 disabled。
 */
export function getTokenTypeOptions(
  config?: ApiRequestConfig,
): Promise<TokenTypeOption[]> {
  return apiClient.get<TokenTypeOption[]>(COMMON_TOKEN_TYPE_LIST_URL, config);
}

// ═══════════════════════════════════════════════════════════════════
// 2. 详情 / 标题 / 子查询 API（10 个）
// ═══════════════════════════════════════════════════════════════════

/**
 * TD 标题列表（index 顶部 CustomTab 切换 + 概览数据源）。
 * 响应 data 直接为数组（无 page/rows 包裹）。注入 id = code。
 */
export async function getApplyList(
  config?: ApiRequestConfig,
): Promise<ApplyListItem[]> {
  const data = await apiClient.post<ApplyListItemApi[] | null, Record<string, never>>(
    TD_APPLY_LIST_URL,
    {},
    config,
  );
  return (data ?? []).map((item) => ({
    ...item,
    id: String(item.code ?? ''),
  }));
}

/**
 * 稳定币列表（view 页 mount 拉，取 [0]）。
 * 返回数组（无分页包裹），字段形态由调用方按业务断言（model.ts 未定义稳定币列表项）。
 */
export function getStablecoinList(
  data?: Record<string, unknown>,
  config?: ApiRequestConfig,
): Promise<unknown[]> {
  return apiClient.post<unknown[]>(STABLECOIN_LIST_URL, data ?? {}, config);
}

/**
 * 稳定币信息（view 页，surplusCount 可销毁余额）。
 * 注意：尽管语义像 GET，**该 endpoint 实为 POST**（源 `getStablecoinInfoApi` POST，
 * 已与 typings 核对）。
 */
export function getStablecoinInfo(
  data: { stablecoinId?: string | number },
  config?: ApiRequestConfig,
): Promise<StablecoinInfo> {
  return apiClient.post<StablecoinInfo>(STABLECOIN_GET_URL, data, config);
}

/**
 * 合约包列表（index Tab2 上表，已部署合约概览）。
 * body: stablecoinCode。rowKey: packageName（回退 index）。
 */
export async function getContractPackageList(
  params: ContractPackageListParams,
  config?: ApiRequestConfig,
): Promise<ContractPackageListResponse> {
  const { pageNum, pageSize, stablecoinCode } = params;
  const res = await apiClient.post<
    ListResponseApi<ContractPackageItemApi>,
    ListRequestBody<{ stablecoinCode?: string }>
  >(
    CONTRACT_LATEST_INFO_URL,
    {
      data: { stablecoinCode },
      page: { pageNum, pageSize },
    },
    config,
  );
  return mapPaginated<ContractPackageItemApi, ContractPackageItem>(
    res,
    (r) => r.packageName,
  );
}

/**
 * 合约明细列表（index Tab2 下表）。
 * body: stablecoinCode。rowKey: contractName（回退 index）。
 */
export async function getContractDetailList(
  params: ContractDetailListParams,
  config?: ApiRequestConfig,
): Promise<ContractDetailListResponse> {
  const { pageNum, pageSize, stablecoinCode } = params;
  const res = await apiClient.post<
    ListResponseApi<ContractDetailItemApi>,
    ListRequestBody<{ stablecoinCode?: string }>
  >(
    CONTRACT_DETAIL_URL,
    {
      data: { stablecoinCode },
      page: { pageNum, pageSize },
    },
    config,
  );
  return mapPaginated<ContractDetailItemApi, ContractDetailItem>(
    res,
    (r) => r.contractName,
  );
}

/**
 * 部署历史（index 部署历史 Modal）。
 * 接口返回 data[0] 为单条历史记录，此处取首项返回。
 */
export async function getContractDeployHistory(
  stablecoinCode: string,
  config?: ApiRequestConfig,
): Promise<DeployHistoryItem | null> {
  const data = await apiClient.post<DeployHistoryItemApi[] | null, { stablecoinCode: string }>(
    CONTRACT_DEPLOY_HISTORY_URL,
    { stablecoinCode },
    config,
  );
  const first = (data ?? [])[0];
  return first
    ? { ...first, id: String(first.packageName ?? 'deploy-history') }
    : null;
}

/**
 * 部署步骤详情（index 部署 Modal，body taskCode）。
 * 返回 data[0]（含 stepDetailList）。
 */
export async function getDeployStepDetail(
  params: DeployStepDetailParams,
  config?: ApiRequestConfig,
): Promise<DeployStepDetail | null> {
  const data = await apiClient.post<DeployStepDetail[] | null, DeployStepDetailParams>(
    CONTRACT_DEPLOY_STEP_DETAIL_URL,
    params,
    config,
  );
  return (data ?? [])[0] ?? null;
}

/**
 * 储备 / 可销毁余额（Mint/Melt 前拉，组装 modalInfo）。
 * body: stablecoinCode / symbol。
 */
export function getReserveBalance(
  data: ReserveBalanceParams,
  config?: ApiRequestConfig,
): Promise<ReserveBalance> {
  return apiClient.post<ReserveBalance>(RESERVE_BALANCE_URL, data, config);
}

/**
 * 是否有待处理销毁（控制 Melt 按钮禁用）。
 */
export async function hasPendingMelt(
  data: { stablecoinCode?: string },
  config?: ApiRequestConfig,
): Promise<boolean> {
  const result = await apiClient.post<boolean | { data?: boolean } | null>(
    SEARCH_PENDING_MELT_URL,
    data,
    config,
  );
  if (typeof result === 'boolean') return result;
  return Boolean((result as { data?: boolean })?.data);
}

/**
 * 储备账户下拉（edit 页，body currencySymbol，默认选首项）。
 */
export function getReserveList(
  data: ReserveListParams,
  config?: ApiRequestConfig,
): Promise<ReserveAccountOption[]> {
  return apiClient.post<ReserveAccountOption[]>(RESERVE_LIST_URL, data, config);
}

// ═══════════════════════════════════════════════════════════════════
// 3. 写操作 API（13 个：创建/编辑/审批/铸销/部署/启停/删除/钱包/生成钱包/合约包下拉）
// ═══════════════════════════════════════════════════════════════════

/**
 * 新增 TD 提交（useTokenizedDepositSubmit，query.code 为空）。
 * 去误导命名：源 typings `tdApplyAddApi`；忽略 stablecoin-manage.ts 的
 * `saveStablecoinPriceApi`（同 endpoint，命名指向 price 模块属误导）。
 * payload 由调用方组装（含 AES password + coaPayload + walletPayload）。
 */
export function createTDApply<TPayload = unknown>(
  data: TPayload,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(TD_APPLY_ADD_URL, data, config);
}

/**
 * 编辑 TD 提交（useTokenizedDepositSubmit，query.code 存在）。
 * 去误导命名：源 typings `tdOperationEditApi`；忽略
 * stablecoin-manage.ts 的 `updateStablecoinPriceApi`（同 endpoint，误导）。
 */
export function editTDOperation<TPayload = unknown>(
  data: TPayload,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(TD_OPERATION_EDIT_URL, data, config);
}

/**
 * 铸造（type=1）/ 销毁（type=2）（index Mint/Melt Modal）。
 * body: amount / stablecoinCode / type。
 */
export function submitMintMelt(
  data: {
    amount: number | string;
    stablecoinCode: string;
    type: number;
    [key: string]: unknown;
  },
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(MINT_MELT_URL, data, config);
}

/**
 * view 铸造（body: stablecoinCount / stablecoinId / stablecoinName / unit）。
 */
export function issueStablecoin(
  data: {
    stablecoinCount: number | string;
    stablecoinId?: number | string;
    stablecoinName?: string;
    unit?: string;
    [key: string]: unknown;
  },
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(STABLECOIN_ISSUE_URL, data, config);
}

/** view 销毁（body: stablecoinCount / stablecoinId）。 */
export function removeStablecoin(
  data: {
    stablecoinCount: number | string;
    stablecoinId?: number | string;
    [key: string]: unknown;
  },
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(STABLECOIN_REMOVE_URL, data, config);
}

/**
 * 合约部署 / 升级（body: taskCode）。
 * type=1 走 Upgrade（需 b010a498... 权限），其余走 Deploy（14f35a31... 权限）。
 */
export function deployContract(
  data: { taskCode: string; [key: string]: unknown },
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(CONTRACT_DEPLOY_URL, data, config);
}

/**
 * 启用 / 禁用 TD（body: code / enable）。
 * 合并去重：stablecoin.ts `updateStatusApi` 与 stablecoin-manage.ts
 * `statusUpdateApi` 同 endpoint `/td/operation/enable`，合并为一个函数。
 * enable: 1=启用 / 0=禁用。
 */
export function updateTDStatus(
  code: string,
  enable: number,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(TD_OPERATION_ENABLE_URL, { code, enable }, config);
}

/** 删除待审批 TD（body: code）。 */
export function deleteTD(
  code: string,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(TD_OPERATION_DELETE_URL, { code }, config);
}

/**
 * 管理员钱包更新（body: accountId / chainAccountAddress / password(AES) / privateKey）。
 * password 由调用方在提交前 AES 加密。
 */
export function updateAdminWallet(
  data: {
    accountId: number | string;
    chainAccountAddress?: string;
    password?: string;
    privateKey?: string;
    [key: string]: unknown;
  },
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(WALLET_UPDATE_URL, data, config);
}

/**
 * 管理员钱包审批（body: recordId / remark / state）。
 */
export function approvalAdminWallet(
  data: {
    recordId: number | string;
    remark?: string;
    state: string | number;
    [key: string]: unknown;
  },
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(WALLET_APPROVAL_URL, data, config);
}

/**
 * 钱包变更记录（index 钱包表 Examine action）。
 * 注：源 action 项被注释（死代码 actionClick case 'Examine' 保留），
 * 函数保留以备权限码 2b651d39... 复用（token-pair 经验）。
 */
export function getWalletModificationRecord(
  data: { accountId: number | string; [key: string]: unknown },
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(WALLET_MODIFICATION_RECORD_URL, data, config);
}

/**
 * 智能合约包下拉（edit 页 smartContractPackageId Select，body: contractLanguage / tokenType）。
 */
export function getSmartContractOptions(
  data: { contractLanguage?: string; tokenType?: number; [key: string]: unknown },
  config?: ApiRequestConfig,
): Promise<SmartContractOption[]> {
  return apiClient.post<SmartContractOption[]>(
    COMMON_CONTRACT_NEW_DEPLOYMENT_URL,
    data,
    config,
  );
}

/**
 * 生成钱包 keystore（util/wallet/keystore）。
 *
 * 合并去重：common.ts `getWalletKeystoreApi` 与 typings `utilWalletKeystoreApi`
 * 同 endpoint，合并为一个函数。body 按 storageType 分支：
 * - keystore 分支：{ chainType, password(调用方传入明文，内部 AES 加密) }
 * - rigsec 分支：{ chainType, walletType, storageType, roleName,
 *   blockchainCode, tokenName, ifAdd }（不传 password）
 *
 * keystore 分支的 password 经 AES-CBC 加密后提交（与后端解密一致）。
 *
 * @param data.ifAdd 新增 true / 编辑 false（utilWalletKeystoreApi 约定）
 */
export async function generateWalletKeystore(
  data: {
    chainType: string;
    storageType: string;
    /** 仅 keystore 分支：明文密码（内部加密） */
    password?: string;
    /** 仅 rigsec 分支 */
    walletType?: number;
    roleName?: string;
    blockchainCode?: string;
    tokenName?: string;
    /** 新增 true / 编辑 false */
    ifAdd?: boolean;
  },
  config?: ApiRequestConfig,
): Promise<GenerateWalletResult | undefined> {
  const isKeystore = data.storageType === 'key_keystore';
  const body = isKeystore
    ? {
        chainType: data.chainType,
        password: data.password ? getEncryptionData(data.password) : '',
      }
    : {
        chainType: data.chainType,
        walletType: data.walletType,
        storageType: data.storageType,
        roleName: data.roleName,
        blockchainCode: data.blockchainCode,
        tokenName: data.tokenName,
        ifAdd: data.ifAdd,
      };
  const result = await apiClient.post<GenerateWalletResult | null>(
    WALLET_KEYSTORE_URL,
    body,
    config,
  );
  return result ?? undefined;
}

// ═══════════════════════════════════════════════════════════════════
// 4. 编辑页专属子查询 API（5 个，含 2 个动态 URL GET）
// ═══════════════════════════════════════════════════════════════════

/**
 * 编辑详情回填（动态 URL GET）。
 * 源 stablecoin-settings.ts `getDetailApi(code)` → GET
 * `/td/operation/edit/detail/${code}`。字段命名转换（decimalPrecision→decimals 等）
 * 由 useDetailInit hook 处理。
 */
export function getTDOperationEditDetail(
  code: string,
  config?: ApiRequestConfig,
): Promise<TDEditDetail> {
  return apiClient.get<TDEditDetail>(
    `/api/manage/v1/td/operation/edit/detail/${code}`,
    config,
  );
}

/**
 * 密钥服务下拉（edit 页，body blockchainId，默认选首项 keyServiceCode）。
 */
export function getKeyServiceList(
  data: KeyServiceListParams,
  config?: ApiRequestConfig,
): Promise<KeyServiceOption[]> {
  return apiClient.post<KeyServiceOption[]>(KEY_SERVICE_LIST_URL, data, config);
}

/**
 * 管理员钱包列表（edit 页自动拉取，仅 Ethereum Sepolia + Huawei KMS 场景）。
 * body: blockchainId。注入 id。
 */
export async function getAdminWalletList(
  data: AdminWalletListParams,
  config?: ApiRequestConfig,
): Promise<AdminWalletListItem[]> {
  const result = await apiClient.post<AdminWalletListItemApi[] | null, AdminWalletListParams>(
    ADMIN_WALLET_LIST_URL,
    data,
    config,
  );
  return (result ?? []).map((item, index) => ({
    ...item,
    id: String(item.accountType ?? index),
  }));
}

/**
 * 科目模板下拉（COA 设置用，GET + query tokenType）。
 * tokenType: 1=Stablecoin / 5=TD。
 */
export function getFinanceTemplateList(
  params: FinanceTemplateListParams,
  config?: ApiRequestConfig,
): Promise<FinanceTemplateOption[]> {
  return apiClient.get<FinanceTemplateOption[]>(FINANCE_TEMPLATE_LIST_URL, {
    ...config,
    params: { tokenType: params.tokenType },
  });
}

/**
 * 按 reserveAccountId 查 Financial Book（stablecoin COA configured 态只读回填）。
 * 动态 URL GET：`/finance/v1/finance/book/by-reserve/${reserveAccountId}`。
 * 源 typings `financeBookBy_reserveApi`。
 */
export async function getFinanceBookByReserve(
  reserveAccountId: FinanceBookByReserveParams['reserveAccountId'],
  config?: ApiRequestConfig,
): Promise<FinanceBookInfo | null> {
  const data = await apiClient.get<FinanceBookInfo | null>(
    `/api/finance/v1/finance/book/by-reserve/${reserveAccountId}`,
    config,
  );
  return data ?? null;
}

// ═══════════════════════════════════════════════════════════════════
// 5. 公共下拉 / 其他（1 个）
// ═══════════════════════════════════════════════════════════════════

/**
 * 时区下拉（COA 设置用，GET）。
 */
export function getTimezoneOptions(
  config?: ApiRequestConfig,
): Promise<TimezoneOption[]> {
  return apiClient.get<TimezoneOption[]>(COMMON_TIMEZONE_LIST_URL, config);
}

// ═══════════════════════════════════════════════════════════════════
// 6. Mock API（3 个，后端未实装，保留 mock）
// ═══════════════════════════════════════════════════════════════════

/** MOCK - 后端未实装，保留 mock。角色钱包模拟数据生成器（抄源 stablecoin.ts）。 */
function generateMockRoleWallets(tokenId: string): RoleWalletItemApi[] {
  const roles = [
    {
      roleName: 'ContractOwner Role',
      walletAttribute: 'Cold Wallet' as const,
      status: 'Active' as const,
      walletAddress: '0x976EA74026E726554dB657fA54763abd0C3a0aa9',
    },
    {
      roleName: 'ContractConfigurator Role',
      walletAttribute: 'Hot Wallet' as const,
      status: 'Active' as const,
      walletAddress: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955',
    },
    {
      roleName: 'PauseController Role',
      walletAttribute: 'Hot Wallet' as const,
      status: 'Active' as const,
      walletAddress: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
    },
    {
      roleName: 'RoleAdmin Role',
      walletAttribute: 'Hot Wallet' as const,
      status: 'Active' as const,
      walletAddress: '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f',
    },
    {
      roleName: 'Minter Role',
      walletAttribute: 'Hot Wallet' as const,
      status: 'Active' as const,
      walletAddress: '0xdD2FD4581271e230360230F9337D5c0430Bf44C0',
    },
    {
      roleName: 'Burner Role',
      walletAttribute: 'Hot Wallet' as const,
      status: 'Active' as const,
      walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
    },
    {
      roleName: 'Wiper Role',
      walletAttribute: 'Hot Wallet' as const,
      status: 'Active' as const,
      walletAddress: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
    },
    {
      roleName: 'Force Role',
      walletAttribute: 'Hot Wallet' as const,
      status: 'Active' as const,
      walletAddress: '0x2546BcD3c84621e976D8185a91A922aE77ECEc30',
    },
    {
      roleName: 'RegisterController Role',
      walletAttribute: 'Hot Wallet' as const,
      status: 'Active' as const,
      walletAddress: '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720',
    },
    {
      roleName: 'WalletConfigurator Role',
      walletAttribute: 'Hot Wallet' as const,
      status: 'Active' as const,
      walletAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    },
    {
      roleName: 'FreezeController Role',
      walletAttribute: 'Hot Wallet' as const,
      status: 'Active' as const,
      walletAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    },
    {
      roleName: 'Client',
      walletAttribute: 'Hot Wallet' as const,
      status: 'Active' as const,
      walletAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    },
    {
      roleName: 'SP Client',
      walletAttribute: 'Hot Wallet' as const,
      status: 'Active' as const,
      walletAddress: '0xbDA5747bFD65F08deb54cb465eB87D40e51B197E',
    },
  ];

  const roleDescriptions: Record<string, string> = {
    'ContractOwner Role':
      'Deploy contracts; Upgrade contracts; Edit contract owner',
    'ContractConfigurator Role':
      'Initialization and modification of the relationship of contract calls',
    'PauseController Role': 'Pause and resume contracts',
    'RoleAdmin Role':
      'Configure roles in authority contracts and manage wallet addresses',
    'Minter Role': 'Mint stablecoins',
    'Burner Role': 'Burn stablecoins',
    'Wiper Role': 'Burn a specified balance of a designated account.',
    'Force Role': 'Forcibly transfer the balance of a specified wallet',
    'RegisterController Role':
      'Create user wallets; Manage user wallets; Create, edit, enable and disable service providers',
    'WalletConfigurator Role':
      'Create, edit, enable and disable user wallet types; Wallet type information and limit changes',
    'FreezeController Role': 'Freeze/Unfreeze funds in user wallets',
    Client:
      'Ordinary wallet account transfer, authorization, authorized transfer, withdrawal (user transfers to redemption account), balance inquiry',
    'SP Client': 'SP wallet redemption',
  };

  return roles.map((role, index) => ({
    roleWalletId: `RW-${tokenId}-${index + 1}`,
    tokenId,
    roleName: role.roleName,
    walletAddress: role.walletAddress,
    blockchain: 'Ethereum',
    walletAttribute: role.walletAttribute,
    description: roleDescriptions[role.roleName],
    status: role.status,
    createdTime: Date.now() - (15 - index) * 24 * 60 * 60 * 1000,
    updatedTime:
      Date.now() - (15 - index) * 24 * 60 * 60 * 1000 + index * 60 * 60 * 1000,
    createdBy: 'System',
    updatedBy: 'Admin',
  }));
}

/**
 * MOCK - 后端未实装，保留 mock。角色钱包列表（role-wallets.tsx）。
 * setTimeout 300ms 模拟网络延迟，本地 generateMockRoleWallets + 筛选 + 分页。
 */
export function getRoleWalletsList(
  params: RoleWalletListParams,
): Promise<RoleWalletListResponse> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const tokenId = params.tokenId ?? 'TOKEN-001';
      let filtered = generateMockRoleWallets(tokenId);

      if (params.roleName) {
        const searchTerm = params.roleName.toLowerCase();
        filtered = filtered.filter((w) =>
          w.roleName?.toLowerCase().includes(searchTerm),
        );
      }
      if (params.walletAddress) {
        const searchAddress = params.walletAddress.toLowerCase();
        filtered = filtered.filter((w) =>
          w.walletAddress?.toLowerCase().includes(searchAddress),
        );
      }

      const pageNum = params.pageNum ?? 1;
      const pageSize = params.pageSize ?? 10;
      const startIndex = (pageNum - 1) * pageSize;
      const paginated = filtered.slice(startIndex, startIndex + pageSize);

      resolve({
        page: {
          total: filtered.length,
          pageNum,
          pageSize,
        },
        rows: paginated.map((w): RoleWalletItem => ({ ...w, id: String(w.roleWalletId) })),
      });
    }, 300);
  });
}

/**
 * MOCK - 后端未实装，保留 mock。角色钱包详情（含 operations 操作历史）。
 */
export function getRoleWalletDetail(
  roleWalletId: string,
): Promise<RoleWalletItem | null> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const all = generateMockRoleWallets('TOKEN-001');
      const wallet = all.find((w) => w.roleWalletId === roleWalletId);
      if (!wallet) {
        resolve(null);
        return;
      }
      resolve({
        ...wallet,
        id: String(wallet.roleWalletId),
        operations: [
          {
            id: 'OP-001',
            operationId: 'OP-001',
            operationType: 'Configure',
            txHash:
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            description: 'Initial wallet configuration',
            timestamp: wallet.createdTime,
            operator: 'Admin',
            status: 'Success',
          },
          {
            id: 'OP-002',
            operationId: 'OP-002',
            operationType: 'Update',
            txHash:
              '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            description: 'Wallet address updated',
            timestamp: wallet.updatedTime,
            operator: 'Admin',
            status: 'Success',
          },
        ],
      });
    }, 300);
  });
}

/**
 * MOCK - 后端未实装，保留 mock。配置角色钱包提交。
 * 返回标准 ApiResponse 信封（code/message/data）。
 */
export function configureRoleWallet(
  _params: Record<string, unknown>,
): Promise<ApiResponse<null>> {
  void _params;
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        code: 0,
        message: 'Wallet configuration submitted successfully',
        data: null,
      });
    }, 500);
  });
}
