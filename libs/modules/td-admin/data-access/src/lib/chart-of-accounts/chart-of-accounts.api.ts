import { apiClient, type ApiRequestConfig } from '@myorg/shared/data-access-api';
import type {
  ChartOfAccountsItem,
  ChartOfAccountsListParams,
  ChartOfAccountsListResponse,
  CurrencyOption,
} from './chart-of-accounts.model';
import type {
  BookAccountBatchSaveReqVO,
  BookAccountToggleReqVO,
  ChartOfAccountsBasicInfoResp,
  CoaTreeNodeResp,
  EodBalancesPagedResp,
  EodDetailRespVo,
  LegacyEodBalancesResp,
} from './chart-of-accounts-detail.model';

const COA_LIST_URL = '/api/finance/v1/finance/coa/list';
const CURRENCY_LIST_URL = '/api/manage/v1/common/currency/list';

// 详情页 endpoints（迁移自源项目 view/constants.ts）
const COA_BASIC_INFO_URL = '/api/finance/v1/finance/coa/detail/basic';
const COA_TREE_URL = '/api/finance/v1/finance/coa/detail/tree';
const COA_BATCH_SAVE_URL = '/api/finance/v1/finance/coa/account/batch-save';
const COA_DISABLE_URL = '/api/finance/v1/finance/coa/account/disable';
const COA_ENABLE_URL = '/api/finance/v1/finance/coa/account/enable';
const EOD_BALANCES_URL = '/api/finance/v1/finance/coa/detail/eod-balances';
const EOD_DETAIL_URL = '/api/finance/v1/finance/coa/detail/eod-detail';

/**
 * 后端原始列表行（无 `id` 字段，`financeBookId` 为 number）。
 * 仅用于在 API 层完成 `id` 注入，不对外暴露。
 */
interface ChartOfAccountsRowApi {
  financeBookId: number;
  bookNo: string;
  bookName: string;
  tokenType?: number;
  currencyCode?: string;
  status?: number;
  timeZone?: string;
  bookTemplateId?: number;
  tokens?: ChartOfAccountsItem['tokens'];
  eodCutoffTime?: string;
  lastEodPostingRun?: string;
  reserveAssetName?: string;
  statusName?: string;
  createdBy?: string;
  createdOn?: number;
}

interface ChartOfAccountsListResponseApi {
  page?: ChartOfAccountsListResponse['page'];
  rows?: ChartOfAccountsRowApi[];
}

/**
 * 查询 COA 列表（服务端分页）。
 *
 * 请求体结构与源项目一致：`{ data: filters, page: { pageNum, pageSize } }`。
 * 返回前将每个原始行注入字符串 `id`（= `financeBookId`）以满足 DataTable 契约。
 */
export async function getChartOfAccountsList(
  params: ChartOfAccountsListParams,
  config?: ApiRequestConfig
): Promise<ChartOfAccountsListResponse> {
  const response = await apiClient.post<ChartOfAccountsListResponseApi>(
    COA_LIST_URL,
    {
      data: params.filters,
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    },
    config
  );

  return {
    page: response.page,
    rows: (response.rows ?? []).map((row): ChartOfAccountsItem => ({
      ...row,
      id: String(row.financeBookId),
    })),
  };
}

/**
 * 查询货币下拉（公共接口）。
 *
 * 失败时调用方应回退到列表数据去重（见 feature 层货币选项构建）。
 */
export function getCurrencyList(config?: ApiRequestConfig): Promise<CurrencyOption[]> {
  return apiClient.get<CurrencyOption[]>(CURRENCY_LIST_URL, config);
}

// ── 详情页：COA 编辑 ──────────────────────────────────────────────────

/** 读取账本基本信息（Basic Information tab）。 */
export function getCoaBasicInfo(
  financeBookId: number,
  config?: ApiRequestConfig
): Promise<ChartOfAccountsBasicInfoResp> {
  return apiClient.get<ChartOfAccountsBasicInfoResp>(
    `${COA_BASIC_INFO_URL}/${financeBookId}`,
    config
  );
}

/** 读取 COA 树。失败时调用方回退到本地 mock（COA_ROWS / SECOND_BOOK_COA_ROWS）。 */
export function getCoaTree(
  financeBookId: number,
  config?: ApiRequestConfig
): Promise<CoaTreeNodeResp[]> {
  return apiClient.get<CoaTreeNodeResp[]>(
    `${COA_TREE_URL}/${financeBookId}`,
    config
  );
}

/** 批量保存 COA 账户（含草稿 / 编辑 / 新增）。 */
export function saveCoaAccounts(
  req: BookAccountBatchSaveReqVO,
  config?: ApiRequestConfig
): Promise<unknown> {
  return apiClient.post<unknown>(COA_BATCH_SAVE_URL, req, config);
}

/** 启用账户。 */
export function enableCoaAccounts(
  req: BookAccountToggleReqVO,
  config?: ApiRequestConfig
): Promise<unknown> {
  return apiClient.post<unknown>(COA_ENABLE_URL, req, config);
}

/** 停用账户。 */
export function disableCoaAccounts(
  req: BookAccountToggleReqVO,
  config?: ApiRequestConfig
): Promise<unknown> {
  return apiClient.post<unknown>(COA_DISABLE_URL, req, config);
}

// ── 详情页：EOD Statements ────────────────────────────────────────────

export interface EodBalancesRequest {
  startDate?: number;
  endDate?: number;
  pageNum?: number;
  pageSize?: number;
}

/**
 * 查询 EOD 余额列表（服务端分页）。
 * 无日期范围时 `data` 传空对象（与源项目一致）。
 */
export function getEodBalances(
  financeBookId: number,
  params: EodBalancesRequest = {},
  config?: ApiRequestConfig
): Promise<EodBalancesPagedResp | LegacyEodBalancesResp> {
  const { startDate, endDate, pageNum = 1, pageSize = 10 } = params;
  return apiClient.post<EodBalancesPagedResp | LegacyEodBalancesResp>(
    `${EOD_BALANCES_URL}/${financeBookId}`,
    {
      data:
        Number.isFinite(startDate) && Number.isFinite(endDate)
          ? { startDate, endDate }
          : {},
      page: { pageNum, pageSize },
    },
    config
  );
}

/** 读取 EOD 明细原始响应（由 buildEodStatementDetail 转换为展示模型）。 */
export function getEodStatementDetail(
  financeBookEodId: number | string,
  config?: ApiRequestConfig
): Promise<EodDetailRespVo> {
  return apiClient.get<EodDetailRespVo>(
    `${EOD_DETAIL_URL}/${financeBookEodId}`,
    config
  );
}
