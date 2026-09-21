/**
 * sp-reserve 域审核组件 barrel（迁移文档 §7 步骤 8，5 个组件）。
 *
 * 迁移自 td-manage `src/pages/approval-manage/components/`：
 * - serviceProvider.tsx（521 行）→ ServiceProviderApproval
 * - reserve-asset.tsx（106 行）→ ReserveAssetApproval
 * - reserve-asset-transaction.tsx（110 行）→ ReserveAssetTransactionApproval
 * - top-up.tsx（152 行）→ TopUpApproval
 * - withdrawal.tsx（147 行）→ WithdrawalApproval
 *
 * 组件注册到 dispatcher 的 COMPONENT_REGISTRY 由汇总阶段统一处理（避免 6 批并行冲突）。
 */
export { ServiceProviderApproval } from './service-provider-approval';
export { ReserveAssetApproval } from './reserve-asset-approval';
export { ReserveAssetTransactionApproval } from './reserve-asset-transaction-approval';
export { TopUpApproval } from './top-up-approval';
export { WithdrawalApproval } from './withdrawal-approval';
