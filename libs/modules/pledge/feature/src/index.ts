// pledge feature barrel.
//
// 占位：pl-1 仅建骨架 + group 注册。页面组件由 pl-2~pl-10 填充（此处导出占位组件）。
// 对齐 cross-chain feature 结构（group 容器：每子模块各自 manifest，id=子模块名）。
// 命名空间路径：@myorg/modules/pledge/feature
//
// registry（module-registry.ts）按子模块名加载：
// - asset-transaction：list → AssetTransactionListPage，create → AssetTransactionEditPage
// - reserve-asset-list：list → ReserveAssetListPage，detail → ReserveAssetDetailPage，
//   create → ReserveAssetCategoryAddPage

// 子模块A：asset-transaction（储备资产交易）
export { AssetTransactionListPage } from './lib/asset-transaction-list-page';
export { AssetTransactionEditPage } from './lib/asset-transaction-edit-page';

// 子模块B：reserve-asset-list（储备资产）
export { ReserveAssetListPage } from './lib/reserve-asset-list-page';
export { ReserveAssetDetailPage } from './lib/reserve-asset-detail-page';
export { ReserveAssetCategoryAddPage } from './lib/reserve-asset-category-add-page';
// pl-5：新增/编辑储备资产共用 Drawer（从 reserve-asset-list-page 抽出，避免单文件过大触发 nx lazy 误报）。
export { ReserveAssetDrawer } from './lib/reserve-asset-drawer';
export type { DrawerState } from './lib/reserve-asset-drawer';

// pl-1：2 个子模块 manifest（group 机制：group 容器不进 registry，每子模块各自 manifest，
// id=子模块名，routes component 用通用 key list/detail/create）。对齐 cross-chain feature 结构。
// 由 apps 的 module-registry 按 realModule（子模块名）加载对应 manifest。
export {
  assetTransactionManifest,
  reserveAssetListManifest,
} from './lib/module-manifest';
