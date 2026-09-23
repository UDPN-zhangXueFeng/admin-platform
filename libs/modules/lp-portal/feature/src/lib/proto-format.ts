/**
 * 原型口径公共格式化件（方案 12 §3 P0：三门户各建一份同构件，供逐页改造消费）。
 *
 * 与 ./format 的分工：format 承载旧口径（formatTime/formatMoney/formatAmount/
 * maskAddress，签名不动）；本文件承载原型合并后的新口径，文案源为 LPP 原型
 * client/src/lib/formatters.js 与 demo AGENTS §3.14.3：
 * - formatUtc8：毫秒时间戳 → UTC+8 字面量 `YYYY-MM-DD HH:mm:ss`（不随浏览器
 *   时区；方案 §8「时间 (UTC+8) 口径」逐页验收项）；
 * - formatRate：固定 4 位小数、不加千分位（`1.0000` / `0.9901` / `1380.5000`）；
 * - formatTokenAmount：千分位 + 按精度 HALF_UP 后去掉无意义尾零
 *   （`4,825,000.000000` → `4,825,000`、`10.10` → `10.1`）；
 * - formatPercent：入参为百分数数值，去尾零（`28.00%` → `28%`、`0.30` → `0.3%`）；
 * - formatDuration：自适应 `6 ms` / `52s` / `2m 05s` / `4h 21m`，单位跟数值。
 *
 * 空值口径统一 `'-'`（原型页面 EMPTY 同款）；非数字原样返回，不静默掩掉脏数据
 * （同 formatAmount 约定）。
 */

import { formatAmount } from './format';

const EMPTY = '-';

/**
 * 毫秒时间戳 → UTC+8 字面量 `YYYY-MM-DD HH:mm:ss`。
 * 实现为 UTC 时间 +8h 后取 UTC 分量拼装，输出不随浏览器时区；空/非法 → `'-'`。
 */
export function formatUtc8(
  ms: number | string | null | undefined,
): string {
  if (ms === null || ms === undefined || ms === '') return EMPTY;
  const n = Number(ms);
  if (!Number.isFinite(n)) return String(ms);
  const d = new Date(n + 8 * 60 * 60 * 1000);
  const p = (x: number) => String(x).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}` +
    ` ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
  );
}

/**
 * 汇率：固定 `digits`（默认 4）位小数、不加千分位；空 → `'-'`；非数字原样返回。
 * 极小汇率（如 0.00072435）压到 4 位会丢精度，精度取舍口径已确认（demo AGENTS §3.14.3）。
 */
export function formatRate(
  v: number | string | null | undefined,
  digits = 4,
): string {
  if (v === null || v === undefined || v === '') return EMPTY;
  const num = Number(String(v).trim().replace(/,/g, ''));
  if (Number.isNaN(num)) return String(v);
  return num.toFixed(digits);
}

/**
 * Token 数量：千分位 + 按精度 HALF_UP 后去掉无意义尾零。
 * `decimals` 缺省沿用入参原小数位（登记精度由调用方显式传）；空 → `'-'`；
 * 非数字原样返回。千分位与进位复用 {@link formatAmount}（字符串 + BigInt，大额不丢精度）。
 */
export function formatTokenAmount(
  v: number | string | null | undefined,
  decimals?: number,
): string {
  if (v === null || v === undefined || v === '') return EMPTY;
  const s = String(v).trim();
  const dot = s.indexOf('.');
  const scale = decimals ?? (dot === -1 ? 0 : s.length - dot - 1);
  const base = formatAmount(s, scale);
  const m = /^(-?[\d,]+)\.(\d+)$/.exec(base);
  if (!m) return base;
  const fraction = m[2].replace(/0+$/, '');
  return fraction ? `${m[1]}.${fraction}` : m[1];
}

/**
 * 百分比：入参为百分数数值（`'28.00'` / `'0.30%'` → `'28%'` / `'0.3%'`），
 * 去掉无意义尾零（原型 formatPercent：28.00% → 28%、0.30% → 0.3%、1.00% → 1%）；
 * 空值 → `'-'`；非数字原样返回。比值（0.28）需调用方先 ×100。
 */
export function formatPercent(
  v: number | string | null | undefined,
): string {
  if (v === null || v === undefined || v === '') return EMPTY;
  const text = String(v).trim();
  const num = Number(text.replace(/%/g, '').replace(/,/g, ''));
  if (Number.isNaN(num)) return text;
  return `${num}%`;
}

/**
 * 时长（毫秒）自适应展示：`6 ms` / `52s` / `2m 05s` / `4h 21m`（demo AGENTS
 * §3.14.3：单位跟数值，列表表头不再写单位）。亚毫秒值保留 1 位小数（`0.6 ms`，
 * 数值 <1 时不四舍五入成 0）；空/负/非法 → `'-'`。
 */
export function formatDuration(
  milliseconds: number | string | null | undefined,
): string {
  if (
    milliseconds === null ||
    milliseconds === undefined ||
    milliseconds === ''
  ) {
    return EMPTY;
  }
  const ms = Number(milliseconds);
  if (!Number.isFinite(ms) || ms < 0) return String(milliseconds);
  if (ms < 1) return `${ms.toFixed(1)} ms`;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return seconds
      ? `${minutes}m ${String(seconds).padStart(2, '0')}s`
      : `${minutes}m`;
  }
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
