/**
 * Journal Entries (旧版 Bill Rule) 枚举常量与状态映射。
 *
 * 迁移自 td-manage financial/journal-entries（index/edit/view）。
 * business_status / tokenType / lendingType / txType 映射。
 */

export const DEFAULT_PAGE_SIZE = 10;
export const EMPTY_DISPLAY = '--';
export const ALL_VALUE = '';

export interface StatusMeta {
  tone: string;
  labelKey: string;
}

/** 规则状态 business_status：1 启用 / 0 禁用。 */
export const RULE_STATUS_META: Record<number, StatusMeta> = {
  1: { tone: 'green', labelKey: 'status.active' },
  0: { tone: 'default', labelKey: 'status.inactive' },
};
export const RULE_STATE_ACTIVE = 1;
export const RULE_STATE_INACTIVE = 0;
/** bill/operate state：0 禁用 / 1 启用。 */
export const BILL_OPERATE_DISABLE = 0;
export const BILL_OPERATE_ENABLE = 1;

/** Token 类型（TD_TOKEN_TYPE_VALUES，与 journal-entries-new 一致）。 */
export const TD_TOKEN_TYPE_VALUES = [1, 5] as const;
export function resolveTokenTypeMessageKey(
  tt: number | string | null | undefined,
): string | undefined {
  return tt == null || tt === '' ? undefined : `tokenType.${tt}`;
}

/** 借贷类型 lendingType：1 借 / 2 贷。 */
export function resolveLendingTypeMessageKey(
  lt: number | string | null | undefined,
): string | undefined {
  return lt == null || lt === '' ? undefined : `lendingType.${lt}`;
}

/** txType 按 tokenType 切（tokenType=1 → [1-6]，其他 → [3,4,5,6,9,10,12,13,16,17]）。 */
export const TD_TX_TYPES_TOKEN_1 = [1, 2, 3, 4, 5, 6] as const;
export const TD_TX_TYPES_TOKEN_OTHER = [3, 4, 5, 6, 9, 10, 12, 13, 16, 17] as const;
export function getTxTypesByTokenType(tokenType?: number): readonly number[] {
  return tokenType === 1 ? TD_TX_TYPES_TOKEN_1 : TD_TX_TYPES_TOKEN_OTHER;
}
export function resolveTxTypeMessageKey(
  tx: number | string | null | undefined,
): string | undefined {
  return tx == null || tx === '' ? undefined : `txType.${tx}`;
}

/** 科目编码正则（源 edit.tsx reg，数字+小数）。 */
export const SUBJECT_CODE_PATTERN = /^[0-9]+(\.[0-9]{1,100})?$/;
export const SUBJECT_CODE_MAX_LENGTH = 50;

/** tone → Tailwind badge class。 */
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
