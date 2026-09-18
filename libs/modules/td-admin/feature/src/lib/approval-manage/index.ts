export {
  manifest,
} from './module-manifest';
export {
  ApprovalManageListPage,
} from './approval-manage-list-page';
export {
  ApprovalManageDetailPage,
} from './approval-manage-detail-page';
export {
  ApprovalManageOperationPanel,
} from './approval-manage-operation-panel';
export {
  ApprovalManageApprovalLog,
} from './approval-manage-approval-log';
export {
  ApprovalManageEscalationDrawer,
} from './approval-manage-escalation-drawer';
/**
 * approval-manage ui barrel.
 *
 * T5 产出：approval-detail-grid（CustomInformation 迁移）/ approval-status-badge（多族 toneClass）
 * / bus-code-dispatcher（busCode 分发 + 占位策略）。
 */
export * from './approval-detail-grid';
export * from './approval-status-badge';
export * from './bus-code-dispatcher';
/**
 * approval-manage util barrel.
 *
 * T2 产出：constants（枚举/状态码映射/权限/i18n 前缀）+ bus-code-map（dispatcher 事实源）+
 * helpers（formatTimestamp/reSet/hasValue 等纯函数）。
 */
export * from './approval-manage.constants';
export * from './approval-manage.bus-code-map';
export * from './approval-manage.helpers';
