/**
 * bank 域模型（源 `api/bank.ts` + `views/approval/status.ts` 状态映射）。
 *
 * BankRow 与后端 BankRespVO 对齐；BigDecimal 序列化为 JSON number，编辑回填时
 * singleLimit/dailyLimit 兼容 number。
 */

/** 目标 Badge variant 子集（约定 §5：default/secondary/destructive/outline）。 */
export type BankBadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/** 银行行（源 BankRespVO）。connectivityStatus 来自网关域连通性探测结果。 */
export interface BankRow {
  bankId: number;
  bankName: string;
  bankCode: string;
  bic: string;
  currencies: string[];
  singleLimit: string | number;
  dailyLimit: string | number;
  accountConfig: string;
  status: number;
  /** 网关实例连通性（0 未知 / 1 正常 / 2 断开；未登记实例为 0）。 */
  connectivityStatus: number;
  kycInfo: string;
  createTime: number;
}

export interface BankListFilter {
  bankName?: string;
  bankCode?: string;
  status?: number;
}

export interface BankListReq {
  pageNum: number;
  pageSize: number;
  filter: BankListFilter;
}

/** bankId 空 = 新建（草稿）；非空 = 编辑。源 BankSaveReqVO。 */
export interface BankSaveReq {
  bankId?: number;
  bankName: string;
  bankCode: string;
  bic?: string;
  currencies: string[];
  singleLimit: string | number;
  dailyLimit: string | number;
  accountConfig?: string;
  kycInfo?: string;
}

export interface BankSubmitOnboardReq {
  bankId: number;
}

/** 限额变更（KLC）：仅已启用银行（status=20）；返回待生效记录 ID。源 bankLimitChange。 */
export interface BankLimitChangeReq {
  bankId: number;
  singleLimit: number;
  dailyLimit: number;
}

/** 银行冻结/解冻（薄调用 freeze 域端点；targetType=1 银行）。 */
export interface BankFreezeReq {
  bankId: number;
  freeze: boolean;
}

/**
 * 主表 reviewerStatus（CommonStatusEnum）中文映射。源 `views/approval/status.ts`。
 */
export const COMMON_STATUS_LABEL: Record<number, string> = {
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

/** 银行列表筛选状态下拉（源 index.vue 状态筛选项）。 */
export const BANK_STATUS_OPTIONS: ReadonlyArray<{ label: string; value: number }> = [
  { label: 'Saved (Draft)', value: 1 },
  { label: 'Pending Review', value: 5 },
  { label: 'Under Review', value: 10 },
  { label: 'Rejected', value: 15 },
  { label: 'Approved', value: 20 },
  { label: 'Disabled', value: 50 },
];

/**
 * 银行状态 → Badge variant（源 statusTagType 的 info/success/danger/warning
 * 映射到目标 variant 语义：success→default、danger→destructive、warning→outline、其余→secondary）。
 */
export function bankStatusVariant(status: number): BankBadgeVariant {
  if (status === 20 || status === 35 || status === 3) return 'default';
  if (status === 15 || status === 2 || status === 40) return 'destructive';
  if (status === 5 || status === 10 || status === 1) return 'outline';
  return 'secondary';
}

/* ------------------------------------------------------------------ */
/* 银行审批（bank 域内薄调用 /mult/approval/*，避免与他组 approval 域耦合） */
/* 符号一律加 Bank 前缀，防止 barrel 与 approval 域同名导出冲突。       */
/* ------------------------------------------------------------------ */

export interface BankApprovalTodoRow {
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

export interface BankApprovalDoneRow extends BankApprovalTodoRow {
  reviewerTime: number;
  reviewerRemarks: string;
  /** 节点结果：2 拒绝 / 3 通过。 */
  detailReviewerStatus: number;
}

export interface BankApprovalPageReq {
  businessCode?: string;
  keyword?: string;
  /** 仅已办：2 拒绝 / 3 通过。 */
  status?: number;
}

export interface BankApproveButtonDTO {
  approveType?: number;
  withdrawType?: number;
  previousStepType?: number;
  escalationType?: number;
  metaMaskSignType?: number;
}

export interface BankApprovalDetailResp {
  approveButtonDTO: BankApproveButtonDTO;
  businessContent: Record<string, unknown>;
}

/** 审批节点结果中文（源 DETAIL_STATUS_MAP）。 */
export const BANK_DETAIL_STATUS_LABEL: Record<number, string> = {
  0: 'Not Reviewable',
  1: 'Pending Review',
  2: 'Review Failed',
  3: 'Review Approved',
  4: 'Review Not Required',
};

/** 已办节点结果 → Badge variant（3 通过→default、2 拒绝→destructive、其余→secondary）。 */
export function bankDetailStatusVariant(status: number): BankBadgeVariant {
  if (status === 3) return 'default';
  if (status === 2) return 'destructive';
  return 'secondary';
}

/** 银行相关审批业务编码（kissen_bank_onboard / kissen_limit_change）。 */
export const BANK_BUSINESS_CODES = {
  onboard: 'kissen_bank_onboard',
  limitChange: 'kissen_limit_change',
} as const;

/** 银行相关审批业务中文名（源 BUSINESS_NAME_MAP 子集）。 */
export const BANK_BUSINESS_LABEL: Record<string, string> = {
  [BANK_BUSINESS_CODES.onboard]: 'Bank Onboarding Approval',
  [BANK_BUSINESS_CODES.limitChange]: 'Bank Limit Change',
};
