/**
 * Kiss amount formatting（源 views/approval/format.ts formatAmount，4609208 2026-09-18）。
 *
 * Amounts are quantized to the smallest unit the currency system can represent,
 * so display scale follows the row's token decimalDigits — a 2-decimal token must
 * never render "8755.515". Fixed scale with HALF_UP rounding (same as backend
 * setScale), replacing the previous min2/max8 trailing-zero trim.
 *
 * Pure string + BigInt arithmetic: values are decimal(20,8) and lose low digits
 * when coerced through Number, so no Number conversion happens on the value.
 */

/**
 * Formats a numeric-ish amount with thousand separators and a fixed decimal scale.
 *
 * - null / undefined / '' → '-'
 * - non-numeric input is returned verbatim (invalid amounts stay visible, no
 *   silent masking)
 * - scale < 0 is clamped to 0; scale 0 renders an integer without a decimal point
 *
 * @param v - Amount value (string or number; string preferred for precision)
 * @param decimals - Fixed fraction digits, defaults to 2 (token_info DDL default)
 * @returns Grouped amount string, e.g. formatAmount('8755.515', 2) => '8,755.52'
 */
export function formatAmount(
  v: number | string | null | undefined,
  decimals = 2,
): string {
  if (v === null || v === undefined || v === '') return '-';
  const scale = decimals < 0 ? 0 : decimals;
  let s = String(v).trim();
  let sign = '';
  if (s.startsWith('-')) {
    sign = '-';
    s = s.slice(1);
  }
  const dot = s.indexOf('.');
  const int = dot === -1 ? s : s.slice(0, dot);
  const dec = dot === -1 ? '' : s.slice(dot + 1);
  if (!/^\d+$/.test(int) || (dec !== '' && !/^\d+$/.test(dec))) return String(v);
  // Integer digits + kept fraction digits as one numeric string; +1 when the
  // first dropped digit is >= 5 (HALF_UP) so carries propagate (9.99 → 10.00),
  // then split back at `scale`.
  let digits =
    int + (dec.length <= scale ? dec.padEnd(scale, '0') : dec.slice(0, scale));
  if (dec.length > scale && Number(dec[scale]) >= 5) {
    digits = (BigInt(digits) + 1n).toString();
  }
  digits = digits.padStart(scale + 1, '0');
  const intPart = scale === 0 ? digits : digits.slice(0, digits.length - scale);
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (scale === 0) return `${sign}${grouped}`;
  return `${sign}${grouped}.${digits.slice(digits.length - scale)}`;
}
