import { formatAdminDateTime } from '@myorg/shared/util-dates';

/**
 * 原型口径数值/时间格式化工具（BP demo AGENTS.md §3.14.3；plan/12 §3 落地表）。
 *
 * 与 kit.ts 既有能力零重复：formatTime（查看者本地时区）/ fmtAmount / orDash
 * 保持原职责不变，本文件为原型数值格式化层；时间输出查看者本地时间和对应 UTC
 * offset，汇率 4 位小数不加千分位、token 数量按精度去尾零、百分比去零、时长
 * 单位跟数值走。逐页改造时按需切换到本层。
 */


/**
 * 毫秒时间戳 → 当前查看者本地时区的 `Sep 2, 2026, 09:09:10 (UTC+8)`；
 * offset 动态显示。空值及非有限值 → '-'。
 */
export function formatUtc8(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms === 0 || !Number.isFinite(ms)) {
    return '-';
  }
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? '-' : formatAdminDateTime(date);
}

/**
 * 汇率：固定 4 位小数、不加千分位（`1.0000` / `0.9901` / `1380.5000`）。
 * 字符串入参去千分位后解析；非数值原样透出（原型 formatRate 同口径）；空值 → '-'。
 */
export function formatRate(
  value: number | string | null | undefined,
  digits = 4,
): string {
  if (value === null || value === undefined || value === '') return '-';
  const text = String(value).trim().replace(/,/g, '');
  const num = Number(text);
  if (Number.isNaN(num)) return text;
  return num.toFixed(digits);
}

/**
 * Token 数量：千分位 + 按精度（token 登记的 decimalDigits）去尾零
 * （`5,000` / `1,400,000` / `10.1` / `75.25`）。精度缺省 8 位以吞下小数值
 * 不失真；调用方应传 token 的 decimalDigits。空值 → '-'。
 */
export function formatTokenAmount(
  value: number | string | null | undefined,
  precision = 8,
): string {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(num)) return String(value);
  const [int, frac = ''] = num.toFixed(precision).split('.');
  const grouped = Number(int).toLocaleString('en-US');
  const fraction = frac.replace(/0+$/, '');
  return fraction ? `${grouped}.${fraction}` : grouped;
}

/**
 * 百分比：去掉无意义的尾零（`28%` / `0.25%` / `0.3%` / `125%`，不再强制 2 位）。
 * 已带 `%` 的字符串原样透出；非数值原样透出；空值 → '-'。toFixed(6) 只为吸收
 * 浮点尾差（0.1+0.2 之类），仍会继续去零。
 */
export function formatPercent(
  value: number | string | null | undefined,
): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'string' && value.includes('%')) return value;
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return `${String(Number(num.toFixed(6)))}%`;
}

/**
 * 时长：单位跟数值走（`70 ms` / `52s` / `3h 38m`，表头不写单位）。
 * <1s 保留 ms 精度；分钟档秒两位补零（`2m 05s`）；入参毫秒（log costTime），
 * 与 LPP 原型 formatters.formatDuration 逐分档同口径；空/负/非有限 → '-'。
 */
export function formatDuration(ms: number | string | null | undefined): string {
  const num = ms === null || ms === undefined ? NaN : Number(ms);
  if (!Number.isFinite(num) || num < 0) return '-';
  if (num < 1000) return `${Math.round(num)} ms`;
  const totalSeconds = Math.round(num / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return seconds ? `${minutes}m ${String(seconds).padStart(2, '0')}s` : `${minutes}m`;
  }
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
