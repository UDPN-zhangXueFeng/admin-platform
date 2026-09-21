import type {
  AssetCategoryListQuery,
  OperateRecordQuery,
  ReserveAssetListQuery,
  ReserveAssetTxnListQuery,
} from '../pledge.model';

/**
 * pledge TanStack Query key 工厂。
 *
 * 对齐 cross-chain keys 模式：{@code as const} 元组，函数形式返回。
 *
 * 子域：
 * - reserveAsset（储备资产列表 / 详情 / 操作记录）
 * - assetTxn（储备资产交易列表）
 * - category（资产类别下拉）
 * - dropdown（公共下拉：assetOptions / currency / bank）
 *
 * 列表 key 含完整 params（含 pageNum/pageSize/filters），保证筛选条件变化重新查询。
 */
export const pledgeKeys = {
  all: ['pledge'] as const,

  // ── 储备资产 ──
  reserveAsset: () => [...pledgeKeys.all, 'reserve-asset'] as const,
  /** 储备资产分页列表 */
  reserveAssetList: (params: ReserveAssetListQuery) =>
    [...pledgeKeys.reserveAsset(), 'list', params] as const,
  /** 储备资产详情 */
  reserveAssetDetail: (reserveAccountId: number | string) =>
    [...pledgeKeys.reserveAsset(), 'detail', reserveAccountId] as const,
  /** 操作记录分页列表（详情页 Operation Records Tab） */
  operateRecordList: (params: OperateRecordQuery) =>
    [...pledgeKeys.reserveAsset(), 'operate-records', params] as const,

  // ── 储备资产交易 ──
  assetTxn: () => [...pledgeKeys.all, 'asset-txn'] as const,
  /** 储备资产交易分页列表（列表页 + 详情 Tab 共用） */
  assetTxnList: (params: ReserveAssetTxnListQuery) =>
    [...pledgeKeys.assetTxn(), 'list', params] as const,

  // ── 资产类别 ──
  /** 资产类别下拉列表（多页共用，按 reserveAccountId + state 缓存） */
  assetCategoryList: (params: AssetCategoryListQuery = {}) =>
    [...pledgeKeys.all, 'asset-category-list', params] as const,

  // ── 公共下拉 ──
  /** 储备资产下拉（新建交易页，无分页全量） */
  assetOptions: () => [...pledgeKeys.all, 'asset-options'] as const,
  /** Currency 下拉 */
  currencyDropdown: () => [...pledgeKeys.all, 'currency-dropdown'] as const,
  /** Bank 下拉 */
  bankDropdown: () => [...pledgeKeys.all, 'bank-dropdown'] as const,
} as const;
