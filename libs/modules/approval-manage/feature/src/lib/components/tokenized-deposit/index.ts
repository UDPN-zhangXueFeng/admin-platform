/**
 * tokenized-deposit 审核组件 barrel（文档 §7 步骤 6，T6 批次）。
 *
 * 导出 TD 域 3 个审核组件，供 feature 层 bus-code-dispatcher 注册表接入：
 * - {@link TokenApproval}：TD 主单据 Create/Update/Enable/Disable（type 驱动）。
 * - {@link MintApproval}：TD 增发（绿色 +）。
 * - {@link MeltApproval}：TD 销毁（红色 -）。
 *
 * 对应 util BUS_CODE_MAP 的 component 字段：`token` / `mint` / `melt`。
 * mint/melt 共用 {@link MintMeltApproval} 公共实现（isMint 控制色/符号/标题）。
 *
 * NOTE: 注册到 dispatcher 的 COMPONENT_REGISTRY 由汇总阶段统一处理（6 批并行，
 * 避免注册冲突），本文件仅导出组件实现。
 */
export { TokenApproval } from './token-approval';
export type { TokenApprovalProps } from './token-approval';
export { MintApproval } from './mint-approval';
export { MeltApproval } from './melt-approval';
export { MintMeltApproval } from './mint-melt-approval';
export type { MintMeltApprovalProps } from './mint-melt-approval';
