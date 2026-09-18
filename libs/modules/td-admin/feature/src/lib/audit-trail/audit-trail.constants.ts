/**
 * Audit Trail 枚举常量。
 *
 * 迁移自 td-manage financial/audit-trail/index.tsx 的 txType / tokenType 映射。
 * txType / tokenType 的展示文案用模块命名空间语义化 key（modules.audit-trail.txType.${n}），
 * 非源 financial_XXXX / td_transaction_type_* / token_type_* 原文（跟随 journal-entries-new 约定）。
 */

/** 交易类型值（源 index.tsx Select options）。 */
export const TX_TYPE_VALUES = [
  1, 2, 3, 4, 5, 6, 9, 10, 12, 13, 16, 17, 18,
] as const;

/** Token 类型（与 journal-entries-new FIXED_TOKEN_TYPES 一致）。 */
export const FIXED_TOKEN_TYPES = [1, 5] as const;

export const DEFAULT_PAGE_SIZE = 10;
export const EMPTY_DISPLAY = '--';
/** 下拉「全部」值（源用空串）。 */
export const ALL_VALUE = '';

/**
 * txType → i18n message key（modules.audit-trail.txType.${n}）。
 * 未知值返回 undefined，由调用方降级。
 */
export function resolveTxTypeMessageKey(
  txType: number | string | null | undefined,
): string | undefined {
  if (txType == null || txType === '') return undefined;
  return `txType.${txType}`;
}

/** tokenType → i18n message key（modules.audit-trail.tokenType.${n}）。 */
export function resolveTokenTypeMessageKey(
  tokenType: number | string | null | undefined,
): string | undefined {
  if (tokenType == null || tokenType === '') return undefined;
  return `tokenType.${tokenType}`;
}

/** processingStatus → i18n message key（详情 Timeline logList 状态）。 */
export function resolveProcessingStatusMessageKey(
  status: number | string | null | undefined,
): string | undefined {
  if (status == null || status === '') return undefined;
  return `processingStatus.${status}`;
}
