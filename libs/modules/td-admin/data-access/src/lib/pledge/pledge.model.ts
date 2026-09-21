/**
 * pledge 模块类型定义。
 *
 * 字段全部来自源 typings（data-contracts.ts / V1.ts），禁止凭文档猜字段名。
 *
 * 覆盖：
 * - ReserveAssetListItem（列表行）
 * - ReserveAssetListQuery（筛选参数，含 bookStatus 透传字段）
 * - ReserveAssetDetail（详情）
 * - ReserveAssetTxn（储备资产交易）
 * - OperateRecord（操作记录）
 * - AssetCategory（资产类别下拉选项）
 * - 表单值类型（DrawerAddForm / DrawerEditForm / AssetCategoryAddForm / AssetTransactionCreateForm）
 * - 公共响应类型（PageResult / ApiResponse）
 */

// =============================================================================
// 通用
// =============================================================================

/** 后端分页信息（响应）。 */
export interface ResultPageInfo {
  /** 总数 */
  total: number;
}

/** API 标准信封（与 apiClient 解包行为对齐，无需手动 code/message 判断）。 */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/** 分页返回。rows 包裹在 pageInfo 中。 */
export interface PageResult<T> {
  page: ResultPageInfo;
  rows: T[];
}

// =============================================================================
// 字典/下拉选项
// =============================================================================

/** Currency 下拉（DictionaryRespVo） */
export interface CurrencyOption {
  key?: string;
  value?: string;
}

/** Bank 下拉（BankListRespVo） */
export interface BankOption {
  bankId?: number;
  bic?: string;
  bankName?: string;
}

/** 资产类别下拉选项（AssetCateGoryRespVo） */
export interface AssetCategoryOption {
  /** Asset Type Id */
  assetTypeId?: number;
  /** Asset Type Name */
  assetCategoryName?: string;
}

// =============================================================================
// 资产类别详情（ReserveAssetTypeListRespVo — 列表行 & 详情共用）
// =============================================================================

/** 资产类别项（ReserveAssetTypeListRespVo） */
export interface AssetCategory {
  /** Asset Type Id */
  assetTypeId?: number;
  /** Asset Type Code */
  assetTypeCode?: string;
  /** Asset Type Name */
  assetTypeName?: string;
  /** Currency */
  currency?: string;
  /** asset Balance */
  assetBalance?: number;
  /** Share of Total Reserve */
  proportion?: number;
  /** update user */
  updateUser?: string;
  /** update time（timestamp） */
  updateTime?: number;
  /** Status 0:Inactive 1:Active */
  status?: number;
}

// =============================================================================
// Token Overview（TokenOverviewRespVo — 详情页 tokenList 用）
// =============================================================================

/** Token 概览项（TokenOverviewRespVo） */
export interface TokenOverview {
  /** Token Name */
  tokenName?: string;
  /** Token Type */
  tokenType?: string;
  /** Token Price = 1 #{symbol} = #{usPrice} #{currencySymbol} */
  tokenPrice?: number;
  /** symbol */
  symbol?: string;
  /** US Price */
  usPrice?: number;
  /** currency symbol */
  currencySymbol?: string;
  /** Blockchain */
  blockchain?: string;
  /** In Circulation */
  inCirculation?: string;
}

// =============================================================================
// 列表行与查询参数（ReserveAssetListRespVo）
// =============================================================================

/** 储备资产列表行（ReserveAssetListRespVo） */
export interface ReserveAssetListItem {
  /** Reserve Account Id */
  reserveAccountId?: number;
  /** Account Name */
  accountName?: string;
  /** Currency */
  currency?: string;
  /** Balance */
  balance?: number;
  /** Categories count */
  categorieCount?: number;
  /** Categorie List */
  categorieList?: AssetCategory[];
  /** Tokens count */
  tokenCount?: number;
  /** create time（timestamp） */
  createTime?: number;
  /** Status 10:processing 15:rejected 20 Active 50:Inactive */
  status?: number;
  /** 关联的FinanceBook ID */
  financeBookId?: number;
}

/** 储备资产列表筛选参数（ReserveAssetListReqVo + 分页 + bookStatus 透传） */
export interface ReserveAssetListQuery {
  /** Reserve Account Id */
  reserveAccountId?: number;
  /** reseve asset Name */
  accountName?: string;
  /** Currency */
  currency?: string;
  /** Created on start（timestamp） */
  createTimeStart?: number;
  /** Created on end（timestamp） */
  createTimeEnd?: number;
  /** Status 10:processing 15:rejected 20 Active 50:Inactive */
  status?: number;
  /**
   * bookStatus 透传：前端推导的伪状态（configured / not_setup）。
   * 后端不存此字段，API 不传后端——仅页面层用作全量拉取+前端过滤标记。
   */
  bookStatus?: string;
  /** 页码 */
  pageNum: number;
  /** 每页条数 */
  pageSize: number;
}

/** 储备资产列表分页响应 */
export interface ReserveAssetListResponse {
  page: ResultPageInfo;
  rows: ReserveAssetListItem[];
}

// =============================================================================
// 资产详情（ReserveAssetDetailsRespVo）
// =============================================================================

/** 储备资产详情（ReserveAssetDetailsRespVo） */
export interface ReserveAssetDetail {
  /** Reserve Account Id */
  reserveAccountId?: number;
  /** Account Name */
  accountName?: string;
  /** Currency */
  currency?: string;
  /** Balance */
  balance?: number;
  /** Categories count */
  categorieCount?: number;
  /** Categorie List */
  categorieList?: AssetCategory[];
  /** Tokens count */
  tokenCount?: number;
  /** Token List */
  tokenList?: TokenOverview[];
  /** create time（timestamp） */
  createTime?: number;
  /** Status 10:processing 15:rejected 20 Active 50:Inactive */
  status?: number;
}

// =============================================================================
// 储备资产交易（ReserveAssetTxListRespVo）
// =============================================================================

/** 交易列表行（ReserveAssetTxListRespVo） */
export interface ReserveAssetTxn {
  /** Reserve Order Id */
  reserveOrderId: number;
  /** Transaction serial number */
  orderSerialNumber: string;
  /** Reserve Asset Name */
  assetName: string;
  /** Currency */
  currency: string;
  /** Asset Category */
  assetCategoryName: string;
  /** Transaction Direction 1: Inflow 2: Outflow */
  transactionDirection: number;
  /** Transaction Amount */
  transactionAmount: number;
  /** Quantity */
  unit: string;
  /** Create By */
  createdName: string;
  /** Created On（timestamp） */
  createdTime: number;
  /** Status */
  status: number;
  /** Business code */
  businessCode?: string;
  /** Task id */
  taskId?: number;
}

/** 交易列表筛选参数 */
export interface ReserveAssetTxnListQuery {
  /**
   * Reserve Account Id。
   * 仅详情页 Asset Transactions Tab 必传（按指定储备资产过滤交易）；
   * 列表页（asset-transaction/index.tsx）是**全局交易列表，不传此字段**。
   * 故 model 标可选；详情 Tab 通过组件 props 必填保证自身契约。
   */
  reserveAccountId?: number;
  /** Reserve Asset Name */
  assetName?: string;
  /** Order Serial Numbere */
  orderSerialNumber?: string;
  /** Token Id */
  currency?: string;
  /** Asset Category Name */
  assetCategoryName?: string;
  /** Transaction Direction 1:Inflow 2:Outflow 3:Refund */
  transactionDirection?: number;
  /** Start Query Time（timestamp） */
  startQueryTime?: number;
  /** End Query Time（timestamp） */
  endQueryTime?: number;
  /** Status 5:Pending Approval 10:under Approval 15:rejected 35:Approval */
  status?: number;
  /** 页码 */
  pageNum: number;
  /** 每页条数 */
  pageSize: number;
}

/** 交易列表分页响应 */
export interface ReserveAssetTxnListResponse {
  page: ResultPageInfo;
  rows: ReserveAssetTxn[];
}

// =============================================================================
// 操作记录（ReserveAssetOperateRecordRespVo）
// =============================================================================

/** 操作记录行（ReserveAssetOperateRecordRespVo） */
export interface OperateRecord {
  /** Reserve Account Id */
  reserveAccountId?: number;
  /** Record Id */
  recordId?: number;
  /** Operate Type 1:add 2:edit 3:Activate 4:Deactivate 5:add Category */
  operateType?: number;
  /** Account User */
  createUser?: string;
  /** create time（timestamp） */
  createTime?: number;
  /** Status 5:pending Approval 10:Under Approval 15:rejected 20:Approved */
  status?: number;
  /** remarks */
  remarks?: string;
  /** Business code */
  businessCode?: string;
  /** Task id */
  taskId?: number;
}

/** 操作记录筛选参数 */
export interface OperateRecordQuery {
  /** Reserve Account Id */
  reserveAccountId: number;
  /** Operate Type 1:add 2:edit 3:Activate 4:Deactivate 5:add Category, 0=All→空串 */
  operateType?: number;
  /** 页码 */
  pageNum: number;
  /** 每页条数 */
  pageSize: number;
}

/** 操作记录分页响应 */
export interface OperateRecordResponse {
  page: ResultPageInfo;
  rows: OperateRecord[];
}

// =============================================================================
// 资产类别列表查询（AssetCategoryReqVo）
// =============================================================================

/** 资产类别列表筛选 */
export interface AssetCategoryListQuery {
  /** Reserve Account Id */
  reserveAccountId?: number;
  /** state 0:禁用 1:启用 */
  state?: number;
}

// =============================================================================
// 资产列表（下拉，无分页 — reserve/asset/list）
// =============================================================================

/** 储备资产下拉项（ReserveAssetListRespVo，无分页 list 接口） */
export type ReserveAssetOption = ReserveAssetListItem;

// =============================================================================
// 表单值类型
// =============================================================================

/**
 * 新增储备资产表单（Drawer 'new'）。
 *
 * 源 reserve-asset-list/index.tsx onFinish('new') 提交体含 assetCategoryList：
 * 默认塞 name==='Cash' 的资产类别 id（从 category/list 查出）。
 * 可选：若 Cash id 未取到则传空数组（对齐源码 `cashCategoryId ? [id] : []`）。
 */
export interface DrawerAddForm {
  /** Currency */
  currency: string;
  /** Asset Name */
  assetName: string;
  /** 资产类别 id 列表（new 态默认 Cash id） */
  assetCategoryList?: number[];
}

/** 编辑储备资产表单（Drawer 'edit'） */
export interface DrawerEditForm {
  /** Reserve Account Id */
  reserveAccountId: number;
  /** Asset Category List（category ids） */
  assetCategoryList: number[];
}

/** 新增资产类别表单 */
export interface AssetCategoryAddForm {
  /** Category Name List */
  categoryNameList: string[];
  /** Reserve Account Id */
  reserveAccountId: number;
}

/** 新建储备资产交易表单（SaveAssentTransactionReqVo，新版字段） */
export interface AssetTransactionCreateForm {
  /** Reserve Account Id */
  reserveAccountId: number;
  /** Asset Type Id */
  assetTypeId: number;
  /** Transaction Direction 1:Inflow 2:Outflow */
  transactionDirection: number;
  /** Transaction Amount */
  transactionAmount: number;
  /** Quantity */
  unit: string;
}

// =============================================================================
// 写操作请求体（API 层直接使用，对应源 typings ReqVo）
// =============================================================================

/** 新增资产请求体（NewReserveAssetReqVo） */
export type AddReserveAssetReq = DrawerAddForm;

/** 编辑资产类别请求体（UpdateReserveAssetReqVo） */
export type EditReserveAssetReq = DrawerEditForm;

/** 变更资产状态请求体（UpateReserveAssetStatusReqVo） */
export interface ChangeReserveAssetStatusReq {
  /** Reserve Account Id */
  reserveAccountId: number;
  /** status 20启用 50禁用 */
  status: number;
}

/** 新增资产类别请求体（NewReserveAssetCategoryReqVo） */
export type AddAssetCategoryReq = AssetCategoryAddForm;

/** 新建交易请求体（SaveAssentTransactionReqVo） */
export type AssetTransactionCreateReq = AssetTransactionCreateForm;

/** 储备资产详情请求体（ReserveAssetDetailsReqVo） */
export interface ReserveAssetDetailReq {
  /** Reserve Account Id */
  reserveAccountId: number;
}

// =============================================================================
// 资产选项列表（reserve/asset/list 无分页返回）
// =============================================================================

export type ReserveAssetOptionList = ReserveAssetListItem[];
