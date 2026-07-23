/**
 * crosschain-settlement 域审核组件 barrel（迁移文档 §7 步骤 10，3 个组件）。
 *
 * 迁移自 td-manage `src/pages/approval-manage/components/`：
 * - token-pair.tsx（166 行）→ TokenPairApproval（跨链代币对，recordType 驱动新旧差异）
 * - liquidity-pool.tsx（201 行）→ LiquidityPoolApproval（流动性池，operationType===2 差异）
 * - settlement.tsx（124 行）→ SettlementApproval（MMF settlement 分红分配，固定 Create）
 *
 * 对应 util BUS_CODE_MAP 的 component 字段：
 * `tokenPair`（save/update/activate/deactivate_token_pair）/ `liquidityPool`
 * （save/update_liquidity_pool）/ `settlement`（apply_mmf_settlement）。
 *
 * 组件注册到 dispatcher 的 COMPONENT_REGISTRY 由汇总阶段统一处理（避免 6 批并行冲突）。
 */
export { TokenPairApproval } from './token-pair-approval';
export type { TokenPairApprovalProps } from './token-pair-approval';

export { LiquidityPoolApproval } from './liquidity-pool-approval';
export type { LiquidityPoolApprovalProps } from './liquidity-pool-approval';

export { SettlementApproval } from './settlement-approval';
export type { SettlementApprovalProps } from './settlement-approval';
