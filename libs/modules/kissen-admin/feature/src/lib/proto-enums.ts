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

/** 结算单 6 态（KNMS SettlementStatementsPage 4 态 + 2023418 审批在途 5/15；5/15 取通用字典文案，10/20/35/45 保持 DEC-08 业务语义）。 */
export const PROTO_SETTLE_ORDER_STATUS: Record<number, ProtoStatusMeta> = {
  5: { label: 'Pending Approval', rank: 0 },
  10: { label: 'Pending Confirmation', rank: 1 },
  15: { label: 'Rejected', rank: 2 },
  20: { label: 'Confirmed', rank: 3 },
  35: { label: 'Settled', rank: 4 },
  45: { label: 'Voided', rank: 5 },
};

/** Token 状态（KNMS TokenManagementPage；后端 5 'Pending Review'、50 'Disabled' 换原型文案）。 */
export const PROTO_TOKEN_STATUS: Record<number, ProtoStatusMeta> = {
  5: { label: 'Pending Approval', rank: 0 },
  15: { label: 'Rejected', rank: 1 },
  20: { label: 'Active', rank: 2 },
  50: { label: 'Inactive', rank: 3 },
};

/**
 * Token Pair（FX Rate Management）状态。2023418 起建对/改参走审批，补 10
 * 'Under Approval'（通用字典文案）；30 Frozen 为业务例外；50 'Disabled' 保留
 * pair 表文案（与 token 表 'Inactive' 各自独立）。rank 按码值升序。
 */
export const PROTO_PAIR_STATUS: Record<number, ProtoStatusMeta> = {
  5: { label: 'Pending Approval', rank: 0 },
  10: { label: 'Under Approval', rank: 1 },
  15: { label: 'Rejected', rank: 2 },
  20: { label: 'Enabled', rank: 3 },
  30: { label: 'Frozen', rank: 4 },
  50: { label: 'Disabled', rank: 5 },
};

/**
 * 银行状态。2023418 契约：10 'Pending Onboarding' 改为通用字典 'Under Approval'
 * （审批在途语义），新增 2 'Registered'（新建直存态）；50 'Disabled' 取通用字典（弃原型
 * 'Inactive'），20 为银行域例外 'Onboarded'（已入网，2023418）。rank 按码值升序。
 */
export const PROTO_BANK_STATUS: Record<number, ProtoStatusMeta> = {
  1: { label: 'Draft', rank: 0 },
  2: { label: 'Registered', rank: 1 },
  5: { label: 'Pending Approval', rank: 2 },
  10: { label: 'Under Approval', rank: 3 },
  15: { label: 'Rejected', rank: 4 },
  20: { label: 'Onboarded', rank: 5 },
  50: { label: 'Disabled', rank: 6 },
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

/** LP 入网状态（码位 = CommonStatusEnum；label 取通用字典，业务语境 20=Enabled）。 */
export const PROTO_LP_STATUS: Record<number, ProtoStatusMeta> = {
  1: { label: 'Draft', rank: 0 },
  5: { label: 'Pending Approval', rank: 1 },
  10: { label: 'Under Approval', rank: 2 },
  15: { label: 'Rejected', rank: 3 },
  20: { label: 'Enabled', rank: 4 },
  50: { label: 'Disabled', rank: 5 },
};

/** 流动性池状态（值域 5/15/20/50；label 取通用字典，rank 按码值升序）。 */
export const PROTO_POOL_STATUS: Record<number, ProtoStatusMeta> = {
  5: { label: 'Pending Approval', rank: 0 },
  15: { label: 'Rejected', rank: 1 },
  20: { label: 'Enabled', rank: 2 },
  50: { label: 'Disabled', rank: 3 },
};

/**
 * LP 参与的 Token Pair 状态（CommonStatusEnum 子集；label 取通用字典，
 * 1 Draft 为后端恢复态，rank 按码值升序）。
 */
export const PROTO_LP_PAIR_STATUS: Record<number, ProtoStatusMeta> = {
  1: { label: 'Draft', rank: 0 },
  5: { label: 'Pending Approval', rank: 1 },
  10: { label: 'Under Approval', rank: 2 },
  15: { label: 'Rejected', rank: 3 },
  20: { label: 'Enabled', rank: 4 },
  50: { label: 'Disabled', rank: 5 },
};

/**
 * 审批主单状态（我发起的值域 3/5/10/15/20 + 待办 5/10；label 取通用字典
 * approval 语境，3 撤回显式入表，rank 按码值升序）。
 */
export const PROTO_WORKFLOW_TASK_STATUS: Record<number, ProtoStatusMeta> = {
  3: { label: 'Withdrawn', rank: 0 },
  5: { label: 'Pending Approval', rank: 1 },
  10: { label: 'Under Approval', rank: 2 },
  15: { label: 'Rejected', rank: 3 },
  20: { label: 'Approved', rank: 4 },
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
  'approve' | 'reject' | 'return' | 'withdraw',
  (approvalNo: string, businessType: string) => ProtoApprovalActionText
> = {
  approve: (approvalNo, businessType) => ({
    title: 'Approve Workflow Task',
    body1: `Approve "${approvalNo}" (${businessType})?`,
    body2: 'This approves the current step. The request takes effect only after all required steps are approved.',
    confirmLabel: 'Approve',
  }),
  reject: (approvalNo, businessType) => ({
    title: 'Reject Workflow Task',
    body1: `Reject "${approvalNo}" (${businessType})?`,
    body2: 'Once rejected, the request is returned to the requester and cannot be approved unless it is submitted again.',
    confirmLabel: 'Reject',
  }),
  return: () => ({
    title: 'Return to Previous Step',
    body1: 'Return this application to the previous step?',
    body2: 'A comment is required.',
    confirmLabel: 'Return to Previous Step',
  }),
  withdraw: () => ({
    title: 'Withdraw Application',
    body1: 'Withdraw this application?',
    body2: 'This application will leave the approval process.',
    confirmLabel: 'Withdraw',
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
