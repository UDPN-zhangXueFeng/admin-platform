/**
 * 入网申请域模型（源 `types/business.ts` + `views/onboard/index.vue`）。
 *
 * 字段与源逐字段对齐；源 `BankInfo` 因跨域导出需带域前缀，重命名为
 * `OnboardBankInfo`（源 `api/bank.ts` 的唯一消费方即入网页，见迁移契约端点清单）。
 */

/** 入网申请提交（POST /onboard/submit）。 */
export interface OnboardSubmitReq {
  agreeConfirmed: boolean;
  contactName: string;
  contactInfo?: string;
  agreementVersion?: string;
}

/** 入网状态（GET /onboard/status）。status：5 待审核 / 15 拒绝 / 20 通过；尚无申请时为 null。 */
export interface OnboardStatus {
  applyId?: number;
  status?: number;
  approveFeedback?: string;
  agreeTime?: number;
}

/** 银行信息推送缓存（GET /bank/info；源 types/business.ts `BankInfo`）。status：20 启用；supportedCurrencies 逗号分隔。 */
export interface OnboardBankInfo {
  infoId?: number;
  bankId?: number;
  bankName: string;
  bankCode: string;
  bic: string;
  supportedCurrencies: string;
  singleLimit: number;
  dailyLimit: number;
  accountConfig: string;
  status: number;
  version?: number;
  pushTime?: number;
}

/* ------------------------------------------------------------------ */
/* 状态常量（源 views/onboard/index.vue isPending/isApproved/isRejected）*/
/* ------------------------------------------------------------------ */

/** 待审核。 */
export const ONBOARD_STATUS_PENDING = 5;
/** 拒绝。 */
export const ONBOARD_STATUS_REJECTED = 15;
/** 通过。 */
export const ONBOARD_STATUS_APPROVED = 20;

/** 入网状态 → 中文标签（源 el-result 标题派生）。 */
export const ONBOARD_STATUS_LABEL: Record<number, string> = {
  [ONBOARD_STATUS_PENDING]: '待审核',
  [ONBOARD_STATUS_REJECTED]: '已拒绝',
  [ONBOARD_STATUS_APPROVED]: '已通过',
};

/** 入网状态 → Badge variant（conventions §5：成功=default、失败=destructive、中性=secondary）。 */
export const ONBOARD_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  [ONBOARD_STATUS_PENDING]: 'secondary',
  [ONBOARD_STATUS_REJECTED]: 'destructive',
  [ONBOARD_STATUS_APPROVED]: 'default',
};

/** 协议版本号（与平台入网协议版本对齐；源 views/onboard/index.vue AGREEMENT_VERSION）。 */
export const ONBOARD_AGREEMENT_VERSION = '1.0';
