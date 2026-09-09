/**
 * feature 库内共享的展示常量与格式化工具。
 *
 * 由 role/tx/user/log/onboard 各页面原本地副本收敛而来，
 * 语义 1:1（见各函数注释）；唯一有意变更：formatTime 的 locale
 * 由 zh-CN 统一为 en-US（门户用户可见文案英文-only 契约，任务批准）。
 */


/** Select 的「全部」哨兵值（Radix SelectItem 不宜用空串；源 clearable 语义）。 */
export const OPT_ALL = '__all__';

/**
 * 毫秒时间戳 → `2026-09-09 14:30:05 GMT+8`；空值 → '-'。
 *
 * a9dc10e（Kissen 修改 20260907）全站统一 fmtDateTime 数值格式：
 * `YYYY-MM-DD HH:mm:ss` + 本地时区标签（半时区出小数，如 GMT+5.5），
 * 替代原 en-US 长格式（`Sep 2, 2026, 09:09:10 (UTC+8)`，随本批作废）。
 * 上游源 `utils/timezone.ts fmtDateTime()` 同款实现。
 */
export function formatTime(ms: number | null | undefined): string {
  if (!ms) return '-';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '-';
  const p = (n: number) => String(n).padStart(2, '0');
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absHours = Math.abs(offsetMinutes) / 60;
  const tzLabel = `GMT${sign}${absHours % 1 === 0 ? absHours : absHours.toFixed(1)}`;
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())} ${tzLabel}`;
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
