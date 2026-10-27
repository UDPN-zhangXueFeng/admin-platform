import { formatDate } from '@myorg/shared/util-dates';

/**
 * Upstream `reSet` equivalent: two decimals with thousands separators.
 * `0` and `null` render as `0.00`; `undefined`, negatives and non-numbers
 * render as `--` — matching the legacy portal exactly.
 */
export function formatAmount(
  value: number | string | null | undefined,
  fractionDigits = 2,
): string {
  if (value !== undefined && Number(value) >= 0) {
    return Number(value)
      .toFixed(fractionDigits)
      .replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
  }
  return '--';
}

/** Coerce numeric-string API amounts (e.g. "1234.5") into chart-ready numbers. */
export function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Formats API chart timestamps with the shared util-dates formatter,
 * converting epoch numeric strings before parsing; unparseable input is
 * passed through so the backend label stays visible.
 */
export function toChartDate(value: string | number): string {
  const parsed: string | number =
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  const date = new Date(parsed);
  return Number.isNaN(date.getTime()) ? String(value) : formatDate(date, 'yyyy-MM-dd');
}
