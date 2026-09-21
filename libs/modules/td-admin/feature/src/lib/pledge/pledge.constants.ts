/**
 * pledge 模块常量 —— 状态枚举、色映射、权限码。
 *
 * 迁移自 td-manage pledge 模块（asset-transaction + reserve-asset-list）。
 * 全部 8 组状态枚举 + 12 权限码，按第 6 章代码搬运，键值对齐源码。
 *
 * 关键约束（第 8 章运行时坑清单）：
 * - ALL_VALUE = 'all'（非 ''），否则 Radix Select.SelectItem value="" → Runtime Error。
 * - labelKey 用相对 key（如 'reserve_asset_book_status_configured'），不带 'pledge.' 前缀，
 *   页面已 useTranslations('modules.pledge')，带前缀会拼成 modules.pledge.pledge.xxx → MISSING_MESSAGE。
 */

// ═══════════════════════════════════════════════════════════════
// 通用
// ═══════════════════════════════════════════════════════════════

/** 下拉/筛选「全部」值。Radix Select 不接受空串 value，必须用非空字面量。 */
export const ALL_VALUE = 'all';

/** 储备资产列表筛选 bookStatus 时的全量拉取 pageSize（前端过滤用）。 */
export const BOOK_STATUS_PAGE_SIZE = 1000;

// ═══════════════════════════════════════════════════════════════
// 1) 交易方向（asset-transaction）
// ═══════════════════════════════════════════════════════════════

/** 交易方向筛选选项（asset-transaction/index.tsx 列表筛选，0=All）。 */
export const TRANSACTION_DIRECTION_FILTER = [
  { label: 'All', value: 0 },
  { label: 'Inflow', value: 1 },
  { label: 'Outflow', value: 2 },
  { label: 'Refund', value: 3 },
] as const;

/** 交易类型选项（asset-transaction/edit.tsx Radio，字符串值，提交时 Inflow→1 / Outflow→2）。 */
export const TRANSACTION_TYPE_OPTIONS = [
  { label: 'Inflow', value: 'Inflow' },
  { label: 'Outflow', value: 'Outflow' },
] as const;

// ═══════════════════════════════════════════════════════════════
// 2) 账本状态 bookStatus（前端推导的伪状态）
// ═══════════════════════════════════════════════════════════════

/** 账本状态字面量类型。后端不存此字段，前端按 financeBookId 有无推导。 */
export type BookStatusValue = 'not_setup' | 'configured';

/** 根据 financeBookId 推导 bookStatus。有值 → configured，无值 → not_setup。 */
export const getBookStatus = (
  financeBookId?: number | string,
): BookStatusValue => (financeBookId ? 'configured' : 'not_setup');

/** bookStatus 筛选下拉选项（All 的 value 用 ALL_VALUE='all' 非空串）。 */
export const BOOK_STATUS_OPTIONS = [
  { label: 'All', value: ALL_VALUE },
  {
    label: 'reserve_asset_book_status_not_setup',
    value: 'not_setup',
  },
  {
    label: 'reserve_asset_book_status_configured',
    value: 'configured',
  },
] as const;

// ═══════════════════════════════════════════════════════════════
// 3) 储备资产状态（new-view statusColorsBasic → view-basic）
// ═══════════════════════════════════════════════════════════════

/** 储备资产状态色映射（status → antd Badge color）。 */
export const RESERVE_STATUS_COLOR = {
  10: 'processing',
  15: 'error',
  20: 'success',
  50: 'gray',
} as const;

/** 储备资产状态文案映射。 */
export const RESERVE_STATUS_TEXT = {
  10: 'Processing',
  15: 'Rejected',
  20: 'Active',
  50: 'Inactive',
} as const;

/** 储备资产状态筛选选项（All 的 value 用 ALL_VALUE='all' 非空串）。 */
export const RESERVE_STATUS_FILTER = [
  { label: 'All', value: ALL_VALUE },
  { value: '10', label: 'pledge_status_10' },
  { value: '15', label: 'pledge_status_15' },
  { value: '20', label: 'pledge_status_20' },
  { value: '50', label: 'pledge_status_50' },
] as const;

// ═══════════════════════════════════════════════════════════════
// 4) 储备资产交易状态（new-view statusColorsAssetTxn → view-asset-transactions）
// ═══════════════════════════════════════════════════════════════

/** 储备资产交易状态色映射。 */
export const ASSET_TXN_STATUS_COLOR = {
  5: 'orange',
  10: 'orange',
  15: 'error',
  35: 'success',
} as const;

/** 储备资产交易状态文案映射。 */
export const ASSET_TXN_STATUS_TEXT = {
  5: 'Pending Approval',
  10: 'Under Approval',
  15: 'Rejected',
  35: 'Approved',
} as const;

/**
 * 储备资产交易状态筛选选项（asset-transaction/index.tsx 列表筛选）。
 * 与 RESERVE_STATUS_FILTER 对齐：All 的 value 用 ALL_VALUE='all'（非 0、非空串），
 * 页面提交时 `=== ALL_VALUE` 转 undefined（不传后端）。其余 value 为状态数字字符串。
 */
export const ASSET_TXN_STATUS_FILTER = [
  { label: 'All', value: ALL_VALUE },
  { value: '5', label: 'Pending Approval' },
  { value: '10', label: 'Under Approval' },
  { value: '15', label: 'Rejected' },
  { value: '35', label: 'Approved' },
] as const;

// ═══════════════════════════════════════════════════════════════
// 5) 操作记录状态（以 view-operation-records 内嵌 statusDict 为准）
// ═══════════════════════════════════════════════════════════════

/**
 * 操作记录状态映射。
 * 注意：以 view-operation-records.tsx 内嵌 statusDict 为准，
 * new-view 传入的 opStatusColors 数组（['warning','success','error']）键不一致，是死参数，忽略。
 */
export const OP_RECORD_STATUS = {
  5: { label: 'Pending Approval', color: 'orange' },
  10: { label: 'Under Approval', color: 'orange' },
  15: { label: 'Rejected', color: 'error' },
  20: { label: 'Approved', color: 'success' },
} as const;

// ═══════════════════════════════════════════════════════════════
// 6) Token 类型（view-basic.tsx）
// ═══════════════════════════════════════════════════════════════

/** Token 类型文案映射。 */
export const TOKEN_TYPE_TEXT = {
  1: 'Stablecoin',
  5: 'Tokenized Deposit',
} as const;

// ═══════════════════════════════════════════════════════════════
// 7) 操作类型筛选（view-operation-records.tsx）
// ═══════════════════════════════════════════════════════════════

/** 操作类型筛选选项（0=All，提交时 0 → '' 转空串不传后端）。 */
export const OPERATE_TYPE_OPTIONS = [
  { label: 'All', value: 0 },
  { label: 'Add', value: 1 },
  { label: 'Edit', value: 2 },
  { label: 'Activate', value: 3 },
  { label: 'Deactivate', value: 4 },
  { label: 'Add Asset Category', value: 5 },
] as const;

// ═══════════════════════════════════════════════════════════════
// 8) 行操作状态机（reserve-asset-list/index.tsx 状态 → 按钮集）
// ═══════════════════════════════════════════════════════════════

/**
 * 储备资产行操作按钮 key（与页面 handleRowAction 的 switch case 一一对应）。
 * 列表页 renderActions 据此判断每个按钮是否渲染（`getReserveAssetRowActions(status).includes(key)`）。
 */
export type ReserveAssetRowAction =
  | 'AddAssetCategory'
  | 'Edit'
  | 'Deactivate'
  | 'Activate'
  | 'Details'
  | 'NewTransaction';

/**
 * 储备资产行操作状态机：
 * - status 10/15（Processing/Rejected）→ [Details]
 * - status 20（Active）→ [AddAssetCategory, Edit, Deactivate, Details, NewTransaction]
 * - status 50（Inactive）→ [AddAssetCategory, Edit, Activate, Details, NewTransaction]
 * - 其他/未知 status（含 undefined）→ [Details]（保守兜底，避免漏渲染详情入口）
 *
 * 纯函数：列表页 action 渲染的唯一真源。改状态机即改此映射，单测守护。
 */
export function getReserveAssetRowActions(
  status?: number,
): readonly ReserveAssetRowAction[] {
  switch (status) {
    case 20:
      return [
        'AddAssetCategory',
        'Edit',
        'Deactivate',
        'Details',
        'NewTransaction',
      ];
    case 50:
      return [
        'AddAssetCategory',
        'Edit',
        'Activate',
        'Details',
        'NewTransaction',
      ];
    // 10 / 15 / 未知：仅 Details（对齐源码 isTerminal 分支）。
    default:
      return ['Details'];
  }
}

// ═══════════════════════════════════════════════════════════════
// 权限码（12 个 hash）
// ═══════════════════════════════════════════════════════════════

/** pledge 模块 12 个权限码。 */
export const PLEDGE_PERMISSIONS = {
  /** 储备资产列表 Add 按钮 */
  reserveAssetAdd: '0420ca87bee54b22b52e6de7f1fe47d2',
  /** 交易列表 New Transaction 按钮 */
  newTransaction: '279dda9e222c41999cdf40f4abfb95b3',
  /** 交易列表 Import 按钮 */
  importTransactions: '9ff729760d214aeca8031ece0c2abfe3',
  /** 交易列表 Adjustment 按钮（disabled） */
  adjustment: '30164ccf62fc40e48f39ea0f2bb45780',
  /** 交易列表行 Details */
  txnDetails: '2b20163b55494e8f8c69b900f8fec099',
  /** 储备资产列表行 NewTransaction */
  newTransactionRow: '37385ae8b9e34ef08b27c8b12da04092',
  /** 储备资产列表行 Edit */
  reserveAssetEdit: '70d0a3630da2406d8e73408823904483',
  /** 储备资产列表行 Activate */
  activate: '2dbae32431464e5eb9e411c72758803a',
  /** 储备资产列表行 Deactivate */
  deactivate: 'a9cdbde98d2f45b2bd35e750b73bacbf',
  /** 储备资产列表行 Details */
  reserveAssetDetails: 'd417248e488d4da5ae8fa43434319a6f',
  /** 储备资产列表行 AddAssetCategory */
  addAssetCategory: 'ea7dcfcfbd174b4386fef85c6773d225',
  /**
   * view.tsx（死代码）Drawer Detail 权限码。
   * 源文件无路由引用，view.tsx 不挂载菜单，此码仅保留登记，不在目标代码中实际使用。
   */
  txnDrawerDetail: 'd35de3e80ee440f5ac720baee7d45ae9',
} as const;

// ═══════════════════════════════════════════════════════════════
// 9) bookStatus 前端过滤（列表页核心难点①，等价源 customFetch）
// ═══════════════════════════════════════════════════════════════

/**
 * bookStatus 前端过滤结果（displayRows = 当前页切片，total = 过滤后总条数）。
 *
 * 泛型签名：util 层不依赖 data-access 的 model，由调用方传入行类型 T 和
 * `getBookStatusValue` 提取器（从行取 financeBookId 推导 bookStatus）。
 */
export interface BookStatusFilterResult<T> {
  /** 当前页应展示的行（已按 pageNum/pageSize 切片）。 */
  displayRows: T[];
  /** 过滤后总条数（过滤态 = filteredRows.length；非过滤态 = rawTotal）。 */
  total: number;
}

/**
 * bookStatus 前端过滤 + 伪分页重算。
 *
 * 逻辑（对齐 reserve-asset-list/index.tsx customFetch / 页面 useMemo）：
 * - 非过滤态（bookStatus === ALL_VALUE 或 undefined）：原样返回，total 用后端 rawTotal。
 * - 过滤态：① 全量行（已由调用方以 pageSize=BOOK_STATUS_PAGE_SIZE 拉取）
 *   ② 按 bookStatus 过滤 → ③ 按 pageNum/pageSize 切片 → total 用 filteredRows.length。
 *
 * 注意：调用方负责"全量拉取"（requestParams.pageSize = BOOK_STATUS_PAGE_SIZE），
 * 本函数只做内存过滤 + 切片 + 重算 total。
 *
 * @param allRows        后端返回的全部行（过滤态下应为全量 pageSize=1000）。
 * @param bookStatus     当前 bookStatus 筛选值（ALL_VALUE/'not_setup'/'configured'）。
 * @param pageNum        当前页码（1-based）。
 * @param pageSize       每页条数（过滤态下的切片粒度）。
 * @param rawTotal       后端响应的原始 total（非过滤态用）。
 * @param getBookStatusValue 从行推导 bookStatus 的提取器（默认读 row.bookStatus）。
 */
export function applyBookStatusFilter<T>(
  allRows: readonly T[],
  bookStatus: string | undefined,
  pageNum: number,
  pageSize: number,
  rawTotal: number,
  getBookStatusValue: (row: T) => BookStatusValue = (row) =>
    (row as unknown as { bookStatus?: BookStatusValue }).bookStatus ??
    'not_setup',
): BookStatusFilterResult<T> {
  // 非过滤态：后端已分页，原样返回。
  if (bookStatus === undefined || bookStatus === ALL_VALUE) {
    return { displayRows: [...allRows], total: rawTotal };
  }
  // 过滤态：filter → slice → total = filteredRows.length（关键，否则分页器条数对不上）。
  const filteredRows = allRows.filter(
    (row) => getBookStatusValue(row) === bookStatus,
  );
  const startIndex = (pageNum - 1) * pageSize;
  return {
    displayRows: filteredRows.slice(startIndex, startIndex + pageSize),
    total: filteredRows.length,
  };
}

// ═══════════════════════════════════════════════════════════════
// 10) Drawer 资产类别 name→id 映射（edit 提交，列表页详情页共用）
// ═══════════════════════════════════════════════════════════════

/**
 * Drawer edit 态提交时的 assetTypeName → assetTypeId 映射。
 *
 * 泛型签名：util 层不依赖 data-access 的 AssetCategory 类型，由调用方传入项类型 T
 * 和提取器（assetTypeName / assetTypeId）。项结构 = { assetTypeName?: string; assetTypeId?: number }。
 *
 * 兜底：assetTypeName 空或 assetTypeId 非 number 的项跳过（对齐源码 line 562-572
 * `typeof el.assetTypeId === 'number'` 过滤 + 空 categorieList 返回空 Map）。
 */
export function buildNameToIdMap<T>(
  categorieList: readonly T[] | undefined | null,
  getName: (item: T) => string | undefined = (item) =>
    (item as unknown as { assetTypeName?: string }).assetTypeName,
  getId: (item: T) => number | undefined = (item) =>
    (item as unknown as { assetTypeId?: number }).assetTypeId,
): Map<string, number> {
  const map = new Map<string, number>();
  if (!Array.isArray(categorieList)) return map; // 空 categorieList 兜底
  for (const item of categorieList) {
    const name = getName(item);
    const id = getId(item);
    if (name && typeof id === 'number') {
      map.set(name, id);
    }
  }
  return map;
}
