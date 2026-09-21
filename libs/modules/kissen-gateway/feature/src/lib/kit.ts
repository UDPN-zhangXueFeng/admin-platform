/**
 * feature 库内共享的展示常量与格式化工具。
 *
 * 由 role/tx/user/log/onboard 各页面原本地副本收敛而来，
 * 语义 1:1（见各函数注释）；时间统一复用 shared 的管理台格式。
 */

import { formatAdminDateTime } from '@myorg/shared/util-dates';

/** Select 的「全部」哨兵值（Radix SelectItem 不宜用空串；源 clearable 语义）。 */
export const OPT_ALL = '__all__';

/**
 * 毫秒时间戳 → shared 管理台日期时间格式，并附查看者本地时区；空值 → '-'。
 * 时区标签由 shared 根据查看者本地时区计算。
 */
export function formatTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms === 0 || !Number.isFinite(ms)) {
    return '-';
  }
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? '-' : formatAdminDateTime(date);
}

/** datetime-local 字符串（YYYY-MM-DDTHH:mm）→ 毫秒时间戳（源 datetimerange value-format="x"）；空/无效 → undefined。 */
export function toEpochMs(value: string): number | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.getTime();
}

/** 空值统一显示 '-'（源 `|| '-'` 语义）。 */
export function orDash(v: string | number | null | undefined): string {
  return v === null || v === undefined || v === '' ? '-' : String(v);
}

/** 数值展示规整：String(Number(v)) 去无效尾零；null/undefined → '-'（源 fmtAmount / fmtRate 同实现）。 */
export function fmtAmount(v: number | null | undefined): string {
  return v == null ? '-' : String(Number(v));
}
