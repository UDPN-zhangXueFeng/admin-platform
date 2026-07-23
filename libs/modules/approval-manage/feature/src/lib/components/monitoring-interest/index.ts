/**
 * approval-manage monitoring-interest 域审核组件 barrel（迁移文档 §7 步骤 9 批次 4）。
 *
 * 4 个只读展示组件，对应 util BUS_CODE_MAP 的 component 字段值：
 * - monitoringRule       → MonitoringRuleApproval
 * - monitoringResultProcess → MonitoringResultProcessApproval
 * - interestRule         → InterestRuleTypeApproval
 * - interestFee          → InterestFeeApproval
 *
 * dispatcher（detail-page）的 COMPONENT_REGISTRY 在汇总阶段统一注册（6 批并行，
 * 各批次不动 dispatcher 注册表，避免冲突）。
 */
export { MonitoringRuleApproval } from './monitoring-rule-approval';
export type { MonitoringRuleApprovalProps } from './monitoring-rule-approval';

export { MonitoringResultProcessApproval } from './monitoring-result-process-approval';
export type { MonitoringResultProcessApprovalProps } from './monitoring-result-process-approval';

export { InterestRuleTypeApproval } from './interest-rule-approval';
export type { InterestRuleTypeApprovalProps } from './interest-rule-approval';

export { InterestFeeApproval } from './interest-fee-approval';
export type { InterestFeeApprovalProps } from './interest-fee-approval';
