/**
 * LP Portal 通用格式化工具（源 `src/utils/format.ts` 1:1 移植，不引 dayjs）。
 *
 * 语义基线（工作清单 B8 / map json「通用格式化工具」）：
 * - formatMoney：v2.3 e591f85 起空值（null/undefined/''）→ '-'；其余千分位
 *   分组、保留后端原样小数位（不归一/不四舍五入）、无货币符号；
 * - formatTime：毫秒时间戳 → `YYYY-MM-DD HH:mm:ss`，非法/空 → '-'；
 * - maskAddress：长度 > 12 显前 6 + `****` + 后 4，否则原样，空值 → '-'。
 *
 * 后续域（topup/rate/pair/tx-flow/settle/system）只 import 本文件，勿改动既有签名。
 */

/** 毫秒时间戳 → YYYY-MM-DD HH:mm:ss；非法/空 → '-' */
export function formatTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(Number(ms))) return '-';
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return '-';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours(),
  )}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 数字千分位（保留原小数位，不四舍五入，无货币符号，负号保留）；v2.3 起空值 → '-' */
export function formatMoney(
  v: number | string | null | undefined,
): string {
  if (v === null || v === undefined || v === '') return '-';
  const s = String(v);
  const [int, dec] = s.split('.');
  const sign = int.startsWith('-') ? '-' : '';
  const digits = sign ? int.slice(1) : int;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec === undefined ? `${sign}${grouped}` : `${sign}${grouped}.${dec}`;
}

/** 账户地址掩码：长度大于 12 保留前 6 与后 4，中间 ****；否则原样，空值 → '-' */
export function maskAddress(addr?: string | null): string {
  if (!addr) return '-';
  if (addr.length > 12) return `${addr.slice(0, 6)}****${addr.slice(-4)}`;
  return addr;
}
