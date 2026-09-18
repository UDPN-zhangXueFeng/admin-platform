/**
 * Chart of Accounts 领域模型。
 *
 * 字段名 1:1 镜像源项目 `td-manage` 的 `ChartOfAccountsRow`，
 * 仅额外补一个 `id: string`（shared DataTable 的 `{ id: string }` 契约）。
 * 时间戳为 epoch 毫秒。
 */

/** 账本-token 关联（`tokens` 列展开项）。 */
export interface BookTokenRel {
  bookTokenRelId?: number;
  financeBookId?: number;
  tokenId?: number;
  createTime?: number;
  tokenName?: string;
}

/** COA 列表行（已注入字符串 `id`，供 DataTable 使用）。 */
export interface ChartOfAccountsItem {
  /** DataTable 契约要求；由 `financeBookId` 转换而来。 */
  id: string;
  financeBookId: number;
  bookNo: string;
  bookName: string;
  tokenType?: number;
  currencyCode?: string;
  status?: number;
  timeZone?: string;
  bookTemplateId?: number;
  tokens?: BookTokenRel[];
  eodCutoffTime?: string;
  lastEodPostingRun?: string;
  reserveAssetName?: string;
  statusName?: string;
  createdBy?: string;
  createdOn?: number;
}

/** 列表筛选条件（对应后端请求体的 `data` 字段）。 */
export interface ChartOfAccountsListFilters {
  bookName?: string;
  bookNo?: string;
  reserveAssetName?: string;
  currencyCode?: string;
  tokenType?: number;
  status?: number;
  createTimeStart?: number;
  createTimeEnd?: number;
}

/** 列表请求参数（分页 + 筛选）。 */
export interface ChartOfAccountsListParams {
  pageNum: number;
  pageSize: number;
  filters: ChartOfAccountsListFilters;
}

/** 列表响应（`apiClient` 已 unwrap 信封后的形状）。 */
export interface ChartOfAccountsListResponse {
  page?: {
    total?: number;
    pageNum?: number;
    pageSize?: number;
  };
  rows?: ChartOfAccountsItem[];
}

/** 货币下拉项（`/common/currency/list` 返回项）。 */
export interface CurrencyOption {
  key?: string;
  value?: string;
}
