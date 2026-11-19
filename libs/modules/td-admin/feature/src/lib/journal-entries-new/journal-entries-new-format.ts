const EMPTY_DISPLAY = '--';

type Amount = string | number | null | undefined;

/** Pad monetary displays where required, never round or coerce a decimal string to Number. */
function formatDecimal(value: Amount, group: boolean, minimumFractionDigits = 0, hideZero = false): string {
  if (value == null || value === '') return hideZero ? '' : EMPTY_DISPLAY;
  const text = String(value);
  const match = /^([+-]?)(\d+|(?=\.\d))(?:\.(\d*))?$/u.exec(text.trim().replaceAll(',', ''));
  if (!match) return text;
  const [, sign, digits, fraction = ''] = match;
  if (hideZero && !/[1-9]/u.test(digits + fraction)) return '';
  const integer = digits || '0';
  const whole = group ? integer.replace(/\B(?=(\d{3})+(?!\d))/gu, ',') : integer;
  const decimals = fraction.padEnd(minimumFractionDigits, '0');
  return `${sign}${whole}${decimals ? `.${decimals}` : ''}`;
}

export function formatListAmount(value: Amount, currency?: string): string {
  const amount = formatDecimal(value, true);
  return currency && value != null && value !== '' ? `${amount} ${currency}` : amount;
}

export const formatBlockHeight = (value: Amount) => formatDecimal(value, true);
export const formatPostingAmount = (value: Amount) => formatDecimal(value, false, 2);
export const formatTAccountAmount = (value: Amount) => formatDecimal(value, true, 2, true);
