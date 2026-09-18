/**
 * financial 域审核组件 barrel（迁移文档 §7 步骤 11，4 个组件 + 1 公共原语）。
 *
 * 迁移自 td-manage `src/pages/approval-manage/components/`：
 * - financial-coa.tsx（541 行）→ FinancialCoaApproval（fin_coa_ 模糊匹配，科目表激活）
 * - financial-normalization.tsx（373 行）→ FinancialNormalizationApproval（规范化规则）
 * - financial-posting-rule.tsx（410 行）→ FinancialPostingRuleApproval（记账规则，2 态子集）
 * - financial-suspense-adjustment.tsx（270 行）→ FinancialSuspenseAdjustmentApproval
 *   （唯一调 API；当前 detailInfo 兜底渲染，见组件注释限制）
 *
 * 对应 util FINANCIAL_FUZZY_MATCHERS 的 component 字段：
 * `financialCoa` / `financialNormalization` / `financialPostingRule` / `financialSuspenseAdjustment`。
 *
 * financial-info-primitives 为 4 组件共享 UI 原语（InfoSection/InfoGrid/FinancialStatusBadge/
 * pickFirstValue/pickFirstRaw/useFinancialT/toneClass），本 barrel 一并 re-export 供复用。
 *
 * 组件注册到 dispatcher 的 COMPONENT_REGISTRY 由汇总阶段统一处理（避免 6 批并行冲突）。
 */
export { FinancialCoaApproval } from './financial-coa-approval';
export type { FinancialCoaApprovalProps } from './financial-coa-approval';

export { FinancialNormalizationApproval } from './financial-normalization-approval';
export type { FinancialNormalizationApprovalProps } from './financial-normalization-approval';

export { FinancialPostingRuleApproval } from './financial-posting-rule-approval';
export type { FinancialPostingRuleApprovalProps } from './financial-posting-rule-approval';

export { FinancialSuspenseAdjustmentApproval } from './financial-suspense-adjustment-approval';
export type { FinancialSuspenseAdjustmentApprovalProps } from './financial-suspense-adjustment-approval';

export {
  InfoGrid,
  InfoSection,
  FinancialStatusBadge,
  pickFirstValue,
  pickFirstRaw,
  useFinancialT,
  toneClass,
} from './financial-info-primitives';
