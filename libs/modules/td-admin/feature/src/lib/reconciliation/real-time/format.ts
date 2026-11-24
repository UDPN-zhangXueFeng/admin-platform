import { format } from 'date-fns';
import { formatAdminDateTime, formatDate } from '@myorg/shared/util-dates';
import { EMPTY_FIELD_VALUE } from '../reconciliation.constants';

export type Amount = string | number | null | undefined;

const decimalPattern = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d{1,3}))?$/i;
const wholeNumber = new Intl.NumberFormat('en-US');

interface Decimal {
  units: bigint;
  scale: number;
}

function decimal(value: Amount): Decimal | null {
  const match = value == null ? null : decimalPattern.exec(String(value));
  if (!match) return null;
  const [, sign, whole, fraction = '', exponent = '0'] = match;
  if (!whole && !fraction) return null;

  const scale = fraction.length - Number(exponent);
  const units = BigInt(sign + (whole + fraction));
  return scale < 0
    ? { units: units * 10n ** BigInt(-scale), scale: 0 }
    : { units, scale };
}
function combine(left: Decimal, right: Decimal, subtract = false): Decimal {
  const scale = Math.max(left.scale, right.scale);
  const a = left.units * 10n ** BigInt(scale - left.scale);
  const b = right.units * 10n ** BigInt(scale - right.scale);
  return { scale, units: subtract ? a - b : a + b };
}

function rounded({ units, scale }: Decimal, places: number): Decimal {
  if (scale <= places) return { units: units * 10n ** BigInt(places - scale), scale: places };
  const factor = 10n ** BigInt(scale - places);
  const magnitude = units < 0n ? -units : units;
  const adjusted = (magnitude + factor / 2n) / factor;
  return { units: units < 0n ? -adjusted : adjusted, scale: places };
}

function render({ units, scale }: Decimal, group = false, fixed = false): string {
  const negative = units < 0n;
  const digits = String(negative ? -units : units).padStart(scale + 1, '0');
  const start = digits.length - scale;
  const integer = digits.slice(0, start);
  const fraction = fixed ? digits.slice(start) : digits.slice(start).replace(/0+$/, '');
  return (negative ? '-' : '') + (group ? wholeNumber.format(BigInt(integer)) : integer) + (fraction ? '.' + fraction : '');
}

export function formatAmount(value: Amount, options?: { nonZero?: boolean; places?: number }) {
  const exact = decimal(value);
  if (!exact || (options?.nonZero && exact.units === 0n)) return EMPTY_FIELD_VALUE;
  return options?.places == null
    ? render(exact, true)
    : render(rounded(exact, options.places), true, true);
}

export function subtractAmounts(left: Amount, right: Amount): string | undefined {
  const a = decimal(left);
  const b = decimal(right);
  return a && b ? render(combine(a, b, true)) : undefined;
}

export function suspenseTotals(entries: readonly { accountCode: string; amount: Amount; direction: number }[], debit: number, credit: number) {
  let dr: Decimal = { units: 0n, scale: 0 };
  let cr = dr;
  let valid = entries.length > 0;
  for (const entry of entries) {
    const value = decimal(entry.amount);
    if (!entry.accountCode || !value || value.units <= 0n) valid = false;
    if (value && entry.direction === debit) dr = combine(dr, value);
    else if (value && entry.direction === credit) cr = combine(cr, value);
    else valid = false;
  }
  const diff = rounded(combine(dr, cr, true), 2);
  return { dr: render(dr, true), cr: render(cr, true), diff: render(diff, true), balanced: diff.units === 0n, valid };
}

function parseTimestamp(value?: string | number | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

export function formatReconTime(value?: string | number | null, dateOnly = false): string {
  const date = parseTimestamp(value);
  if (!date) return EMPTY_FIELD_VALUE;
  return dateOnly ? formatDate(date) : formatAdminDateTime(date);
}

export function localDateInput(value?: string | number | null): string {
  return format(parseTimestamp(value) ?? new Date(), 'yyyy-MM-dd');
}

export function dateBound(value: string, end = false): number | undefined {
  return value ? new Date(value + (end ? 'T23:59:59' : 'T00:00:00')).getTime() : undefined;
}
