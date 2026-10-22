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

/** 详情可用操作能力位（源 ApproveButtonDTO；2026-10-21 实测 1=可用，2=不可用，0 兜底不可用）。 */
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
  /**
   * 主单状态(CommonStatusEnum)。2026-10-21 实测:detail / detailByBusiness
   * 均未返回该字段(响应键仅 approveButtonDTO/taskId/recordExists/businessContent/
   * history);任务键入口由列表行兜底,业务键入口无兜底 → 可选,调用方须容忍 undefined。
   */
  reviewerStatus?: number;
  /** 当前节点名(仅主单 5/10 在途时有值;后端暂未返回,调用方须容忍 undefined)。 */
  currentStepName?: string | null;
}

/** 业务键详情请求（busCode + businessId；busId=1 恒有效，禁止 0 兜底查询）。 */
export interface ApprovalBusinessDetailReq {
  busCode: string;
  busId: number;
}

/**
 * 业务键详情响应：审批未发起/记录不存在时 recordExists=false（不报错），
 * 存在时附带任务键 taskId 与 ApprovalDetailResp 同构字段。
 */
export type ApprovalBusinessDetailResp =
  | { recordExists: false }
  | ({ recordExists: true; taskId: number } & ApprovalDetailResp);

/** 我发起的列表过滤（后端按当前身份查 create_user_id；reviewerStatus=主单状态）。 */
export interface ApprovalApplyPageReq {
  businessCode?: string;
  keyword?: string;
  /** 主单状态值域 3 撤回 / 5 待审 / 10 审批中 / 15 拒绝 / 20 通过。 */
  reviewerStatus?: number;
}

/** 我发起的分页请求体。 */
export interface ApprovalApplyListReq {
  pageNum: number;
  pageSize: number;
  filter: ApprovalApplyPageReq;
}

/** 我发起的行（currentStepName=null=已出流程；canWithdraw 由后端按主单状态+发起人判定）。 */
export interface ApprovalApplyRow {
  taskId: number;
  applyCode: string;
  businessCode: string;
  busDesc: string;
  businessId: number;
  reviewerStatus: number;
  currentStepName: string | null;
  canWithdraw: boolean;
  createTime: number;
}

/**
 * 主表 reviewerStatus（CommonStatusEnum 定稿通用字典，全仓唯一一份）。
 * 2 已注册（银行入网）/ 22 审核通过待启用 / 3 撤回为业务值域，审批主单语境
 * 只出现 3/5/10/15/20；业务语境 20 由 commonStatusLabel 渲染为 Enabled。
 */
export const COMMON_STATUS_MAP: Record<number, string> = {
  1: 'Draft',
  2: 'Registered',
  3: 'Withdrawn',
  5: 'Pending Approval',
  10: 'Under Approval',
  15: 'Rejected',
  20: 'Approved',
  22: 'Audit Passed (Pending Enable)',
  25: 'Signed',
  30: 'Submitting',
  35: 'Settled',
  40: 'Submit Failed',
  45: 'Deleted',
  50: 'Disabled',
};

/**
 * 通用状态文案。context='business' 仅把 20 渲染为 Enabled（实体语境），
 * 'approval' 保持审批主单语义 Approved；未知码回退 String(status) 原样可见。
 */
export function commonStatusLabel(
  status: number,
  context: 'approval' | 'business' = 'business',
): string {
  if (context === 'business' && status === 20) return 'Enabled';
  return COMMON_STATUS_MAP[status] ?? String(status);
}

/** 节点 reviewerStatus（ApprovalStatusEnum 定稿文案；9 退回入时间线）。 */
export const DETAIL_STATUS_MAP: Record<number, string> = {
  0: 'Not Reviewable',
  1: 'Pending Approval',
  2: 'Rejected',
  3: 'Approved',
  4: 'Review Not Required',
  9: 'Returned',
};

/** 业务中文名（WorkflowBusinessTypeEnum.description，源 BUSINESS_NAME_MAP 定稿英文）。 */
export const BUSINESS_NAME_MAP: Record<string, string> = {
  kissen_bank_onboard: 'Bank Onboarding Approval',
  kissen_lp_onboard: 'LP Onboarding Approval',
  kissen_lp_pair: 'LP Currency Pair Participation Change',
  kissen_lp_split: 'LP Share Change',
  kissen_lp_pool: 'LP Pool Approval',
  kissen_rate_change: 'Exchange Rate Markup Change',
  kissen_pair_toggle: 'Currency Pair Enable/Disable',
  kissen_settle_confirm: 'Settlement Order Confirmation',
  kissen_split_transfer: 'Split Transfer',
  // P1 存量实体审批（2026-10-22）
  kissen_bank_toggle: 'Bank Enable/Disable',
  kissen_access_key_revoke: 'Access Key Revocation',
  kissen_gateway_toggle: 'Gateway Instance Enable/Disable',
  kissen_gateway_key_reset: 'Gateway Down Key Reset',
  kissen_token_toggle: 'Token Enable/Disable',
  kissen_token_param: 'Token Min Liquidity Change',
  kissen_pair_status: 'Currency Pair Enable/Disable (P1)',
  kissen_settle_void: 'Settlement Order Void',
  kissen_lp_pair_status: 'LP Pair Participation Enable/Disable',
};

/**
 * 业务特有状态码映射（优先于通用字典）：split_transfer 1/2/3 只查本表
 * （不得回退 Draft/Registered/Withdrawn）；settle 用 DEC-08 专用语义 10/20/35/45。
 */
export const BUSINESS_STATUS_MAP: Record<string, Record<number, string>> = {
  kissen_split_transfer: { 1: 'Processing', 2: 'Success', 3: 'Failed' },
  kissen_settle_confirm: {
    10: 'Pending Confirmation',
    20: 'Confirmed',
    35: 'Settled',
    45: 'Voided',
  },
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
 * 20/35 success=default · 15/2/40 danger=destructive · 5/10/1 warning=secondary ·
 * 其余（含主单 3 撤回）=outline。
 */
export function approvalStatusVariant(
  status: number,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 20 || status === 35) return 'default';
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
