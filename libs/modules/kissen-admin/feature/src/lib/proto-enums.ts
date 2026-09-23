/**
 * 原型口径状态枚举映射（源 kissen_prototype KNMS 各列表页 STATUS_ORDER / STATUS_OPTIONS
 * 逐字提取；方案 12 §3：各 app feature 层一份「原型英文文案 ↔ 后端码」字典，前端常量为
 * 唯一字典源——GAP-X-01 有意偏差，无需 STATIC-FILLER 标记）。
 *
 * 每张表约定：
 *  - 键 = 本仓 data-access 各域 model 的后端状态码（数字字面量键，与后端枚举对齐）；
 *  - label = 原型英文文案（逐字；管理端与原型有出入处以原型为准，差异见行内注释）；
 *  - rank = 原型列表状态列的排序位（原型 AGENTS §3.3：枚举列按业务状态机顺序排序，
 *    不按字母序；空值/未知码由调用方排最后）。
 *
 * 徽章语义色（success / warning / danger / info / muted）不写死在本表——由页面改造时
 * 按各页原型的色点口径给出（配合 proto-ui 的 ProtoStatusBadge）。
 */

/** 状态码 → 原型文案 + 原型排序位。 */
export interface ProtoStatusMeta {
  label: string;
  rank: number;
}

/**
 * 交易 13 态全表（KNMS FxTransactionsPage STATUS_ORDER；方案 §4 交易行「13 态状态文案
 * 统一」）。与 TRANSACTION_STATUS_LABEL 的差异（以原型为准）：
 *  - 30 后端 'Advancing' → 原型 'Processing'；
 *  - 35 后端与 40 同文案 'Completed' → 原型拆两态：35 'Settled' / 40 'Completed'。
 */
export const PROTO_TX_STATUS: Record<number, ProtoStatusMeta> = {
  1: { label: 'Created', rank: 0 },
  5: { label: 'Quoted', rank: 1 },
  10: { label: 'Confirmed', rank: 2 },
  20: { label: 'Source Transferring', rank: 3 },
  25: { label: 'Source Verified', rank: 4 },
  30: { label: 'Processing', rank: 5 },
  35: { label: 'Settled', rank: 6 },
  40: { label: 'Completed', rank: 7 },
  50: { label: 'Reversing', rank: 8 },
  60: { label: 'Reversed', rank: 9 },
  70: { label: 'Exception', rank: 10 },
  80: { label: 'Cancelled', rank: 11 },
  90: { label: 'Failed', rank: 12 },
};

/** 结算单 4 态（KNMS SettlementStatementsPage；与 SETTLE_ORDER_STATUS_LABEL 文案一致）。 */
export const PROTO_SETTLE_ORDER_STATUS: Record<number, ProtoStatusMeta> = {
  10: { label: 'Pending Confirmation', rank: 0 },
  20: { label: 'Confirmed', rank: 1 },
  35: { label: 'Settled', rank: 2 },
  45: { label: 'Voided', rank: 3 },
};

/** Token 状态（KNMS TokenManagementPage；后端 5 'Pending Review'、50 'Disabled' 换原型文案）。 */
export const PROTO_TOKEN_STATUS: Record<number, ProtoStatusMeta> = {
  5: { label: 'Pending Approval', rank: 0 },
  15: { label: 'Rejected', rank: 1 },
  20: { label: 'Active', rank: 2 },
  50: { label: 'Inactive', rank: 3 },
};

/**
 * Token Pair（FX Rate Management）状态（KNMS FxRateManagementPage §10 五态）。后端
 * 10 'Under Review' 在原型下拉无对应态，本表不设键（页面改造时按未知码排最后/原样展示，
 * 归并口径待 P3 页面改造核对）。后端 50 'Disabled' 换原型文案（pair 表 'Disabled' 与
 * token 表 'Inactive' 文案不同，各自保留）。
 */
export const PROTO_PAIR_STATUS: Record<number, ProtoStatusMeta> = {
  5: { label: 'Pending Approval', rank: 0 },
  15: { label: 'Rejected', rank: 1 },
  20: { label: 'Enabled', rank: 2 },
  30: { label: 'Frozen', rank: 3 },
  50: { label: 'Disabled', rank: 4 },
};

/**
 * 银行状态（KNMS BankOnboardingPage 7 态：Draft → Pending Onboarding → Pending
 * Approval → Under Approval → Rejected → Active → Inactive）。后端文案差异：5 'Pending
 * Review' → 'Pending Approval'、10 'Registered (Pending Onboarding)' → 'Pending
 * Onboarding'、20 'Onboarded' → 'Active'、50 'Disabled' → 'Inactive'。原型 'Under
 * Approval'（rank 3）为审批中瞬态、后端 bank.status 无独立码（由 approval 域承载），
 * 故不设键；键序保持 rank 序，rank 3 空缺即该瞬态位。
 */
export const PROTO_BANK_STATUS: Record<number, ProtoStatusMeta> = {
  1: { label: 'Draft', rank: 0 },
  10: { label: 'Pending Onboarding', rank: 1 },
  5: { label: 'Pending Approval', rank: 2 },
  15: { label: 'Rejected', rank: 4 },
  20: { label: 'Active', rank: 5 },
  50: { label: 'Inactive', rank: 6 },
};

/**
 * 网关实例状态（KNMS GatewayManagementPage 4 态）。后端文案差异：10 'Pubkey Pushed
 * (Activatable)' → 'Public Key Pushed (Pending Activation)'、50 'Disabled' → 'Inactive'。
 */
export const PROTO_INSTANCE_STATUS: Record<number, ProtoStatusMeta> = {
  1: { label: 'Registered (Unverified)', rank: 0 },
  10: { label: 'Public Key Pushed (Pending Activation)', rank: 1 },
  20: { label: 'Active', rank: 2 },
  50: { label: 'Inactive', rank: 3 },
};

/** LP 入网状态（KNMS LpOnboardingPage；码位 = CommonStatusEnum，后端文案换原型同义文案）。 */
export const PROTO_LP_STATUS: Record<number, ProtoStatusMeta> = {
  1: { label: 'Draft', rank: 0 },
  5: { label: 'Pending Approval', rank: 1 },
  10: { label: 'Under Approval', rank: 2 },
  15: { label: 'Rejected', rank: 3 },
  20: { label: 'Active', rank: 4 },
  50: { label: 'Inactive', rank: 5 },
};

/** 流动性池状态（KNMS LiquidityPoolManagementPage：Active → Processing → Rejected → Inactive；后端 5 'Applying' → 原型 'Processing'）。 */
export const PROTO_POOL_STATUS: Record<number, ProtoStatusMeta> = {
  20: { label: 'Active', rank: 0 },
  5: { label: 'Processing', rank: 1 },
  15: { label: 'Rejected', rank: 2 },
  50: { label: 'Inactive', rank: 3 },
};

/**
 * LP 参与的 Token Pair 状态（KNMS SupportedTokenPairsPage：Active → Processing →
 * Rejected → Inactive）。后端 LP_PAIR 为 CommonStatusEnum 全集，5/10 两个在审码并入
 * 原型 'Processing'（rank 相同、列表内稳定排序保键序），20 'Approved' → 'Active'、
 * 50 'Disabled' → 'Inactive'——归并口径待 P3 页面改造核对。
 */
export const PROTO_LP_PAIR_STATUS: Record<number, ProtoStatusMeta> = {
  20: { label: 'Active', rank: 0 },
  5: { label: 'Processing', rank: 1 },
  10: { label: 'Processing', rank: 1 },
  15: { label: 'Rejected', rank: 2 },
  50: { label: 'Inactive', rank: 3 },
};

/** 工作流任务（审批）状态（KNMS WorkflowTasksPage 4 态；码位 = CommonStatusEnum，'Pending Review'/'Under Review' 换原型文案）。 */
export const PROTO_WORKFLOW_TASK_STATUS: Record<number, ProtoStatusMeta> = {
  5: { label: 'Pending Approval', rank: 0 },
  10: { label: 'Under Approval', rank: 1 },
  20: { label: 'Approved', rank: 2 },
  15: { label: 'Rejected', rank: 3 },
};

/** 工作流配置状态（KNMS WorkflowSettingsPage：Enabled → Disabled；与 WORKFLOW_STATUS_LABEL 一致）。 */
export const PROTO_WORKFLOW_SETTING_STATUS: Record<number, ProtoStatusMeta> = {
  1: { label: 'Enabled', rank: 0 },
  2: { label: 'Disabled', rank: 1 },
};

/** 用户/角色状态（KNMS UserManagementPage / RoleManagementPage；0 'Normal' → 'Active'、1 'Disabled' → 'Inactive'，用户与角色同编号空间）。 */
export const PROTO_USER_STATUS: Record<number, ProtoStatusMeta> = {
  0: { label: 'Active', rank: 0 },
  1: { label: 'Inactive', rank: 1 },
};

/** 操作日志执行结果（KNMS OperationLogsPage §18：后端 1 'Error' → 原型 'Failed'）。 */
export const PROTO_OPERATE_LOG_RESULT: Record<number, ProtoStatusMeta> = {
  0: { label: 'Success', rank: 0 },
  1: { label: 'Failed', rank: 1 },
};

/**
 * 审批动作文案（KNMS WorkflowTaskDetailsPage DECISION_CONFIG 逐字；title/body1/body2
 * 直接喂 proto-ui 的 ActionConfirmDialog——body1 = 疑问句主句、body2 = 后果句）。
 */
export interface ProtoApprovalActionText {
  title: string;
  body1: string;
  body2: string;
  confirmLabel: string;
}

/** @param approvalNo 审批单号 @param businessType 业务类型文案（如 'Token Creation'） */
export const PROTO_APPROVAL_ACTION_TEXT: Record<
  'approve' | 'reject',
  (approvalNo: string, businessType: string) => ProtoApprovalActionText
> = {
  approve: (approvalNo, businessType) => ({
    title: 'Approve Workflow Task',
    body1: `Approve "${approvalNo}" (${businessType})?`,
    body2: 'Once approved, the request is applied and moves to the Actioned tab; the requester is notified with your comment.',
    confirmLabel: 'Approve',
  }),
  reject: (approvalNo, businessType) => ({
    title: 'Reject Workflow Task',
    body1: `Reject "${approvalNo}" (${businessType})?`,
    body2: 'Once rejected, the request is returned to the requester and cannot be approved unless it is submitted again.',
    confirmLabel: 'Reject',
  }),
};

/**
 * 状态码 → 原型文案。空值 → '-'（配合 Dash 口径）；未知码回退 `String(code)` 原样可见
 * （新后端码上线未进字典时不静默吞掉）。
 */
export function protoStatusLabel(
  map: Record<number, ProtoStatusMeta>,
  code: number | string | null | undefined,
): string {
  if (code === null || code === undefined || code === '') return '-';
  const meta = map[Number(code)];
  return meta ? meta.label : String(code);
}

/**
 * 状态码 → 原型排序位（原型 AGENTS §3.3 状态列按业务状态机排序）。空值/未知码返回
 * `Number.POSITIVE_INFINITY`，配合 `sort((a, b) => rank(a) - rank(b))` 恒排最后。
 */
export function protoStatusRank(
  map: Record<number, ProtoStatusMeta>,
  code: number | string | null | undefined,
): number {
  const meta =
    code === null || code === undefined || code === '' ? undefined : map[Number(code)];
  return meta ? meta.rank : Number.POSITIVE_INFINITY;
}
