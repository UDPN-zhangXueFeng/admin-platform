/**
 * Reconciliation 模块纯函数 helpers。
 *
 * 迁移自 td-manage `reconciliation/{real-time,reserve}/detail.tsx` 内联辅助函数。
 * 全部纯函数，无副作用。日期格式化委派 `@myorg/shared/util-dates`（与
 * approval-manage 同源），避免模块内重复 dayjs 封装。
 */

import { EMPTY_FIELD_VALUE } from './reconciliation.constants';

/** 日期时间格式（与 approval-manage DATETIME_FMT 一致）。 */
export const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/** 纯日期格式。 */
export const DATE_FMT = 'YYYY-MM-DD';

/**
 * 格式化时间戳字符串。空值返回占位。
 * 非空值原样返回（后端已格式化为字符串）；如需重排格式由调用方用 `formatDate`。
 */
export function formatTimestamp(
  value?: string | number | null,
): string {
  if (value == null || value === '') return EMPTY_FIELD_VALUE;
  return String(value);
}

/** 格式化区块高度（数字 toLocaleString）；空值/0 占位。 */
export function formatBlockHeight(value?: number | null): string {
  if (value == null || value === 0) return EMPTY_FIELD_VALUE;
  return value.toLocaleString();
}

/** 格式化非零数字；0/空占位。 */
export function formatNonZeroNumber(
  value?: number | null,
  fallback: string = EMPTY_FIELD_VALUE,
): string {
  if (value == null || value === 0) return fallback;
  return value.toLocaleString();
}

/** 格式化货币金额（2 位小数）；空值占位。 */
export function formatCurrencyValue(value?: number | null): string {
  if (value == null) return EMPTY_FIELD_VALUE;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}


/** 解析详情页初始 Tab（query.tab → 'list' | 'investigation'）。 */
export function resolveDetailTab(
  tab?: string | null,
): 'list' | 'investigation' {
  return tab === 'investigation' ? 'investigation' : 'list';
}
