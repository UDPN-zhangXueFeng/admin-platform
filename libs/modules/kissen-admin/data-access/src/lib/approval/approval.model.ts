/** 审批待办行（源 api/approval.ts ApprovalTodoRow，对齐 ApprovalTodoRowVO）。 */
export interface ApprovalTodoRow {
  taskId: number;
  applyCode: string;
  businessCode: string;
  busDesc: string;
  stepName: string;
  reviewerStatus: number;
  businessId: number;
  createUserId: number;
  createUserName: string;
  createTime: number;
}

/** 审批已办行（含处理时间 / 意见 / 节点结果）。 */
export interface ApprovalDoneRow extends ApprovalTodoRow {
  reviewerTime: number;
  reviewerRemarks: string;
  /** 节点结果：2 拒绝 / 3 通过。 */
  detailReviewerStatus: number;
}

/** 审批列表过滤（businessCode 业务类型 / keyword 审批编号或业务描述 / status 仅已办）。 */
export interface ApprovalPageReq {
  businessCode?: string;
  keyword?: string;
  /** 仅已办：2 拒绝 / 3 通过。 */
  status?: number;
}

/** 审批分页列表请求体。 */
export interface ApprovalListReq {
  pageNum: number;
  pageSize: number;
  filter: ApprovalPageReq;
}

/** 详情可用操作能力位（源 ApproveButtonDTO；0=不可用，非 0=可用）。 */
export interface ApproveButtonDTO {
  approveType?: number;
  withdrawType?: number;
  previousStepType?: number;
  escalationType?: number;
  metaMaskSignType?: number;
}

/** 审批流转时间线节点（源 ApprovalHistoryNodeVO；stepOrder 升序）。 */
export interface ApprovalHistoryNode {
  detailId: number;
  stepName: string;
  stepOrder: number;
  reviewerName: string;
  reviewerTime: number;
  reviewerRemarks: string;
  /** 节点结果：2 拒绝 / 3 通过 / 9 退回（后端约定码；0/1/4 由后端过滤不入时间线）。 */
  reviewerStatus: number;
}

/** 审批详情（源 ApprovalDetailResp；businessContent 为动态业务字段，history 为流转时间线）。 */
export interface ApprovalDetailResp {
  approveButtonDTO: ApproveButtonDTO;
  businessContent: Record<string, unknown>;
  /** 3bfe319 新增：审批历史流转记录；无历史时为 null。 */
  history: ApprovalHistoryNode[] | null;
}

/** 主表 reviewerStatus（CommonStatusEnum，源 views/approval/status.ts COMMON_STATUS_MAP）。 */
export const COMMON_STATUS_MAP: Record<number, string> = {
  1: 'Saved (Draft)',
  3: 'Withdrawn',
  5: 'Pending Review',
  10: 'Under Review',
  15: 'Rejected',
  20: 'Approved',
  25: 'Signed',
  30: 'Submitting',
  35: 'Final Confirmation',
  40: 'Submission Failed',
  45: 'Deleted',
  50: 'Disabled',
};

/** 节点 reviewerStatus（ApprovalStatusEnum，源 DETAIL_STATUS_MAP）。 */
export const DETAIL_STATUS_MAP: Record<number, string> = {
  0: 'Not Reviewable',
  1: 'Pending Review',
  2: 'Review Failed',
  3: 'Review Approved',
  4: 'Review Not Required',
};

/** 9 类业务中文名（WorkflowBusinessTypeEnum.description，源 BUSINESS_NAME_MAP）。 */
export const BUSINESS_NAME_MAP: Record<string, string> = {
  kissen_bank_onboard: 'Bank Onboarding Approval',
  kissen_lp_onboard: 'LP Onboarding Approval',
  kissen_lp_pair: 'LP Currency Pair Participation Change',
  kissen_rate_change: 'Exchange Rate Markup Change',
  kissen_pair_toggle: 'Currency Pair Enable/Disable',
  kissen_freeze: 'Emergency Freeze/Unfreeze',
  kissen_settle_confirm: 'Settlement Order Confirmation',
  kissen_split_transfer: 'Split Transfer',
  kissen_limit_change: 'Bank Limit Change',
};

/** 业务特有状态码映射（优先于全局 COMMON_STATUS_MAP，源 views/approval/format.ts）。 */
export const BUSINESS_STATUS_MAP: Record<string, Record<number, string>> = {
  kissen_split_transfer: { 1: 'Processing', 2: 'Success', 3: 'Failed' },
  kissen_settle_confirm: { 20: 'Confirmed', 35: 'Settled' },
};

/**
 * 无审批策略的业务：详情接口会报错，操作按钮禁用。
 * kissen_freeze 保留 busCode 不实现策略（规格 R-4）；kissen_limit_change 策略 M11 落地后移出。
 * 静态字符串键集合 → Record 成员判断（项目规则 ts-set-map）。
 */
export const NO_STRATEGY_BUSINESSES: Record<string, true> = {
  kissen_freeze: true,
};

/** busCode → 中文名（未知兜底原样）。 */
export const businessName = (busCode: string): string =>
  BUSINESS_NAME_MAP[busCode] ?? busCode;

/**
 * 主表状态 → Badge variant（源 statusTagType 映射）。
 * 20/35/3 success=default · 15/2/40 danger=destructive · 5/10/1 warning=secondary · 其余=outline。
 */
export function approvalStatusVariant(
  status: number,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 20 || status === 35 || status === 3) return 'default';
  if (status === 15 || status === 2 || status === 40) return 'destructive';
  if (status === 5 || status === 10 || status === 1) return 'secondary';
  return 'outline';
}

/** 已办节点结果 → Badge variant（3 通过=default / 2 拒绝=destructive / 其余=outline）。 */
export function approvalDetailStatusVariant(
  status: number,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 3) return 'default';
  if (status === 2) return 'destructive';
  return 'outline';
}
