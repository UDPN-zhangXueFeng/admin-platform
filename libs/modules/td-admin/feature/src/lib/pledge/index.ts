// pledge feature barrel.
//
// 占位：pl-1 仅建骨架 + group 注册。页面组件由 pl-2~pl-10 填充（此处导出占位组件）。
// 对齐 cross-chain feature 结构（group 容器：每子模块各自 manifest，id=子模块名）。
// 命名空间路径：.
//
// registry（module-registry.ts）按子模块名加载：
// - asset-transaction：list → AssetTransactionListPage，create → AssetTransactionEditPage
// - reserve-asset-list：list → ReserveAssetListPage，detail → ReserveAssetDetailPage，
//   create → ReserveAssetCategoryAddPage

// 子模块A：asset-transaction（储备资产交易）
export {
  AssetTransactionListPage,
} from './asset-transaction-list-page';
export {
  AssetTransactionEditPage,
} from './asset-transaction-edit-page';

// 子模块B：reserve-asset-list（储备资产）
export {
  ReserveAssetListPage,
} from './reserve-asset-list-page';
export {
  ReserveAssetDetailPage,
} from './reserve-asset-detail-page';
export {
  ReserveAssetCategoryAddPage,
} from './reserve-asset-category-add-page';
// pl-5：新增/编辑储备资产共用 Drawer（从 reserve-asset-list-page 抽出，避免单文件过大触发 nx lazy 误报）。
export {
  ReserveAssetDrawer,
} from './reserve-asset-drawer';
export type {
  DrawerState,
} from './reserve-asset-drawer';

// pl-1：2 个子模块 manifest（group 机制：group 容器不进 registry，每子模块各自 manifest，
// id=子模块名，routes component 用通用 key list/detail/create）。对齐 cross-chain feature 结构。
// 由 apps 的 module-registry 按 realModule（子模块名）加载对应 manifest。
export {
  assetTransactionManifest,
  reserveAssetListManifest,
} from './module-manifest';
// pledge ui barrel.
//
// 命名空间路径：.
// pl-7 填充 pledge-status-badge + pledge-asset-category-pie-chart（recharts）。

export {
  PledgeStatusBadge,
} from './pledge-status-badge';
export type {
  PledgeBadgeVariant,
  PledgeStatusBadgeProps,
} from './pledge-status-badge';

export {
  PledgeAssetCategoryPieChart,
} from './pledge-asset-category-pie-chart';
export type {
  AssetCategoryPieDatum,
  PledgeAssetCategoryPieChartProps,
} from './pledge-asset-category-pie-chart';
// pledge util barrel.
//
// 命名空间路径：.

export {
  // 通用
  ALL_VALUE,
  BOOK_STATUS_PAGE_SIZE,
  // 1) 交易方向
  TRANSACTION_DIRECTION_FILTER,
  TRANSACTION_TYPE_OPTIONS,
  // 2) 账本状态 bookStatus
  getBookStatus,
  BOOK_STATUS_OPTIONS,
  // 3) 储备资产状态
  RESERVE_STATUS_COLOR,
  RESERVE_STATUS_TEXT,
  RESERVE_STATUS_FILTER,
  // 4) 储备资产交易状态
  ASSET_TXN_STATUS_COLOR,
  ASSET_TXN_STATUS_TEXT,
  ASSET_TXN_STATUS_FILTER,
  // 5) 操作记录状态
  OP_RECORD_STATUS,
  // 6) Token 类型
  TOKEN_TYPE_TEXT,
  // 7) 操作类型筛选
  OPERATE_TYPE_OPTIONS,
  // 8) 行操作状态机
  getReserveAssetRowActions,
  // 9) bookStatus 前端过滤
  applyBookStatusFilter,
  // 10) Drawer 资产类别 name→id 映射
  buildNameToIdMap,
  // 权限码
  PLEDGE_PERMISSIONS,
} from './pledge.constants';
export type {
  BookStatusValue,
  ReserveAssetRowAction,
  BookStatusFilterResult,
} from './pledge.constants';

export {
  formatValue,
  formatCurrency,
  formatDecimalInput,
} from './pledge.format';
