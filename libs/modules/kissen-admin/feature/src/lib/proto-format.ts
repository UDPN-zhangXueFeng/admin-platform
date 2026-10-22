/**
 * 原型口径展示格式化（源 kissen_prototype KNMS `client/src/lib/formatters.js` 与
 * FxTransactionDetailsPage 的 formatDuration；方案 12 §3 横切规范）。
 *
 * 本文件补原型口径的其余展示原语 —— 本地时区时间、汇率、token 数量（按精度去尾零）、
 * 百分比（去尾零）、自适应时长。空值统一 '-'（U+002D，方案 §3：禁止 '—' / 'N/A' / 留白）。
 */

import { formatAmount } from './format';
import { formatAdminDateTime } from '@myorg/shared/util-dates';

/** 旧导出名保留；时间按当前查看者本地时区格式化并附带 UTC offset。 */

/**
 * 毫秒时间戳 → `Sep 2, 2026, 09:09:10 (UTC+8)`；offset 按当前查看者时区动态显示。
 *
 * - 0 / null / undefined / 非法 → '-'（与既有 formatTime 空值口径一致）
 * - 字符串数字容忍（后端个别端点返回字符串毫秒）
 */
export function formatUtc8(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';
  const ms = Number(value);
  if (!ms || !Number.isFinite(ms)) return '-';
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? '-' : formatAdminDateTime(date);
}

/** UTC+8 日期键仅用于保留现有日期筛选边界，不用于页面时间展示。 */
export function formatUtc8DateKey(
  value: number | string | null | undefined,
): string {
  if (value === null || value === undefined || value === '') return '-';
  const ms = Number(value);
  if (!ms || !Number.isFinite(ms)) return '-';
  const date = new Date(ms + 8 * 60 * 60 * 1000);
  if (Number.isNaN(date.getTime())) return '-';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )}`;
}

/**
 * 汇率展示：固定 4 位小数、不加千分位（原型 formatters.js formatRate 逐字口径）。
 *
 * `1` => '1.0000' / `0.99009` => '0.9901' / `1380.5` => '1380.5000'。
 * ⚠ 极小汇率（如 0.00072435）压到 4 位会丢精度——精度取舍为原型已确认口径。
 *
 * - null / undefined / '' → '-'
 * - 非数字输入原样返回（无效值保持可见，不静默掩盖，同 formatAmount 哲学）
 * - 容忍已带千分位的输入（先去 ',' 再解析）
 *
 * @param v - Rate value (string or number)
 * @param digits - Fixed fraction digits, defaults to 4 (法币 4 位口径)
 */
export function formatRate(
  v: number | string | null | undefined,
  digits = 4,
): string {
  if (v === null || v === undefined || v === '') return '-';
  const text = String(v).trim().replace(/,/g, '');
  const num = Number(text);
  if (!Number.isFinite(num)) return String(v);
  return num.toFixed(digits);
}

/**
 * Token 数量展示：千分位 + 按精度固定位后去掉无意义尾零（原型 formatters.js
 * formatTokenAmount；精度取该 token 登记时的 decimalDigits）。
 *
 * `4825000.000000`(6) => '4,825,000' / `'10.10'`(2) => '10.1' / `'75.25'`(2) => '75.25'。
 * 舍入与非法回退复用 ./format 的 formatAmount（HALF_UP 到固定位），本函数只做尾零裁剪。
 *
 * @param v - Token amount (string preferred for precision)
 * @param decimals - Token decimal digits, defaults to 2 (token_info DDL 默认)
 */
export function formatTokenAmount(
  v: number | string | null | undefined,
  decimals = 2,
): string {
  const grouped = formatAmount(v, decimals);
  const dot = grouped.indexOf('.');
  if (dot === -1) return grouped; // '-'、整数、非法原样回退均无小数段
  const integer = grouped.slice(0, dot);
  const fraction = grouped.slice(dot + 1).replace(/0+$/, '');
  return fraction ? `${integer}.${fraction}` : integer;
}

/**
 * 百分比展示：去掉无意义的 0，不加千分位（原型 formatters.js formatPercent；2026-09-21
 * 用户口径「28.00% → 28%、0.30% → 0.3%、1.00% → 1%」，不再强制 2 位）。
 *
 * 接受 `'28%'` / `'28'` / `28` / `'28.0%'` / `'0.250'` / `'1,250'` 等形态；
 * 非数字输入原样返回（保留其 %），空值 → '-'。
 *
 * @param v - Percent value in any of the accepted shapes
 */
export function formatPercent(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '-';
  const text = String(v).trim();
  const num = Number(text.replace(/%/g, '').replace(/,/g, ''));
  if (!Number.isFinite(num)) return text;
  // Number → String 自带尾零裁剪（28.00 → '28'、0.30 → '0.3'），与原型实现同构。
  return `${num}%`;
}

/**
 * 时长展示：单位跟着数值自适应（原型 FxTransactionDetailsPage formatDuration +
 * AGENTS §3.14「70 ms / 52s / 2m 05s / 3h 38m / 4h 21m」；列表表头不再写单位）。
 *
 * - < 1s：保留毫秒精度 → '70 ms'（数值 < 1 秒时以 ms 呈现合适精度）
 * - < 60s → '52s'；< 60m → '2m 05s'（秒补零两位；整分不带秒段）；以上 → '4h 21m'
 * - null / undefined / '' / 非法 / 负数 → '-'
 *
 * @param value - Duration in milliseconds
 */
export function formatDuration(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms < 0) return '-';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return seconds ? `${minutes}m ${String(seconds).padStart(2, '0')}s` : `${minutes}m`;
  }
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

