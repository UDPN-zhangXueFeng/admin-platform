/**
 * Statements 枚举常量与状态映射。
 *
 * 迁移自 td-manage financial/statements（index/export/view）。
 * 4 套状态映射（business/export/proof/frequency）+ txType 多选 + 邮箱校验。
 * 状态文案用模块命名空间语义化 key（非源 financial_XXXX/business_status_* 原文）。
 */

export const DEFAULT_PAGE_SIZE = 10;
export const EMPTY_DISPLAY = '--';
export const ALL_VALUE = '';

// ── 状态映射（4 套）──
export interface StatusMeta {
  tone: string;
  labelKey: string;
}

/** 规则状态 business_status：20 启用 / 30 禁用。 */
export const RULE_STATUS_META: Record<number, StatusMeta> = {
  20: { tone: 'green', labelKey: 'status.active' },
  30: { tone: 'default', labelKey: 'status.inactive' },
};
export const RULE_STATE_ACTIVE = 20;
export const RULE_STATE_INACTIVE = 30;
/** rule/operate state：20 启用 / 30 禁用 / 35 删除。 */
export const RULE_OPERATE_ENABLE = 20;
export const RULE_OPERATE_DISABLE = 30;
export const RULE_OPERATE_DELETE = 35;

/** 导出状态 export_status：0-3。 */
export const EXPORT_STATUS_META: Record<number, StatusMeta> = {
  0: { tone: 'orange', labelKey: 'exportStatus.0' },
  1: { tone: 'blue', labelKey: 'exportStatus.1' },
  2: { tone: 'green', labelKey: 'exportStatus.2' },
  3: { tone: 'red', labelKey: 'exportStatus.3' },
};
export const EXPORT_STATE_SUCCESS = 2;
export const EXPORT_STATE_ERROR = 3;

/** 凭证状态 proof_status：2-6（仅 exportState=2 时显示）。 */
export const PROOF_STATUS_META: Record<number, StatusMeta> = {
  2: { tone: 'orange', labelKey: 'proofStatus.2' },
  3: { tone: 'blue', labelKey: 'proofStatus.3' },
  4: { tone: 'blue', labelKey: 'proofStatus.4' },
  5: { tone: 'green', labelKey: 'proofStatus.5' },
  6: { tone: 'red', labelKey: 'proofStatus.6' },
};

/** 导出频率 export_frequency：1/7/30。 */
export const EXPORT_FREQUENCY_VALUES = [1, 7, 30] as const;
export function resolveFrequencyMessageKey(
  f: number | string | null | undefined,
): string | undefined {
  return f == null || f === '' ? undefined : `frequency.${f}`;
}

// ── txType（多选按 issueType 切换）──
export const TD_TX_TYPES_ISSUE_1 = [1, 2, 3, 4, 5, 6] as const;
export const TD_TX_TYPES_ISSUE_OTHER = [3, 4, 5, 6, 9, 10, 13, 16, 17] as const;
export function getTxTypesByIssueType(issueType?: number): readonly number[] {
  return issueType === 1 ? TD_TX_TYPES_ISSUE_1 : TD_TX_TYPES_ISSUE_OTHER;
}
export function resolveTxTypeMessageKey(
  txType: number | string | null | undefined,
): string | undefined {
  return txType == null || txType === '' ? undefined : `txType.${txType}`;
}
export function resolveTokenTypeMessageKey(
  tokenType: number | string | null | undefined,
): string | undefined {
  return tokenType == null || tokenType === ''
    ? undefined
    : `tokenType.${tokenType}`;
}
export function resolveFileTypeMessageKey(
  ft: number | string | null | undefined,
): string | undefined {
  return ft == null || ft === '' ? undefined : `fileType.${ft}`;
}

/** tone → Tailwind badge class（与 suspense-adjustment 一致）。 */
const TONE_CLASS: Record<string, string> = {
  red: 'border-red-200 bg-red-50 text-red-700',
  orange: 'border-orange-200 bg-orange-50 text-orange-700',
  green: 'border-green-200 bg-green-50 text-green-700',
  gold: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  default: 'border-gray-200 bg-gray-50 text-gray-600',
};
export function statusToneClass(tone: string): string {
  return TONE_CLASS[tone] ?? TONE_CLASS.default;
}

// ── 邮箱校验（notifyEmail，源 index/export Drawer rules）──
export const EMAIL_PATTERN =
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(,\s*[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})*$/;
export const NOTIFY_EMAIL_MAX_RECIPIENTS = 20;
export const NOTIFY_EMAIL_MAX_LENGTH = 500;

/** 校验 notifyEmail：返回错误 message key 或 undefined（通过）。 */
export function validateNotifyEmail(
  value: string | undefined,
): string | undefined {
  if (!value) return undefined;
  if (/[，；；\s]+/.test(value)) return 'email.invalidSeparator';
  const emails = value.split(',').filter((e) => e.trim());
  if (emails.length > NOTIFY_EMAIL_MAX_RECIPIENTS) return 'email.tooMany';
  if (!EMAIL_PATTERN.test(value)) return 'email.invalid';
  return undefined;
}
