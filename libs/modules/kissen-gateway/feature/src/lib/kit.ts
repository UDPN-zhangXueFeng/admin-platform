/**
 * feature 库内共享的展示常量与格式化工具。
 *
 * 由 market/role/tx/user/log/onboard 各页面原本地副本收敛而来，
 * 语义 1:1（见各函数注释）；唯一有意变更：formatTime 的 locale
 * 由 zh-CN 统一为 en-US（门户用户可见文案英文-only 契约，任务批准）。
 */

/** Select 的「全部」哨兵值（Radix SelectItem 不宜用空串；源 clearable 语义）。 */
export const OPT_ALL = '__all__';

/** 毫秒时间戳 → en-US 本地时间串（24 小时制，源 toLocaleString 语义）；空值 → '-'。 */
export function formatTime(ms: number | null | undefined): string {
  return ms ? new Date(ms).toLocaleString('en-US', { hour12: false }) : '-';
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
