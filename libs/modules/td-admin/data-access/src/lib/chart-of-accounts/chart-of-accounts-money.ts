interface DecimalAmount {
  units: bigint;
  scale: number;
}

export const zeroAmount: DecimalAmount = { units: 0n, scale: 0 };

export function parseBookAmount(value: unknown): DecimalAmount | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const match = /^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(String(value).trim().replaceAll(',', ''));
  if (!match) return undefined;
  const [, sign, integer, fraction = '', exponent] = match;
  const scale = fraction.length - (exponent ? Number(exponent) : 0);
  if (!Number.isSafeInteger(scale) || Math.abs(scale) > 1000) return undefined;
  const units = BigInt(`${sign}${integer}${fraction}`);
  return scale < 0 ? { units: units * powerOfTen(-scale), scale: 0 } : { units, scale };
}

const powerOfTen = (scale: number) => 10n ** BigInt(scale);

export function addBookAmounts(a: DecimalAmount, b: DecimalAmount): DecimalAmount {
  if (a.scale === b.scale) return { units: a.units + b.units, scale: a.scale };
  const scale = Math.max(a.scale, b.scale);
  return { units: a.units * powerOfTen(scale - a.scale) + b.units * powerOfTen(scale - b.scale), scale };
}

export function negateBookAmount(value: DecimalAmount): DecimalAmount {
  return { units: -value.units, scale: value.scale };
}

export function formatBookAmount(value: DecimalAmount, currency?: string): string {
  const { units, scale } = value;
  const negative = units < 0n;
  const magnitude = negative ? -units : units;
  let cents: bigint;
  if (scale <= 2) {
    cents = magnitude * powerOfTen(2 - scale);
  } else {
    const divisor = powerOfTen(scale - 2);
    cents = magnitude / divisor + (magnitude % divisor * 2n >= divisor ? 1n : 0n);
  }
  const integer = (cents / 100n).toLocaleString('en-US');
  const fraction = String(cents % 100n).padStart(2, '0');
  return `${negative ? '-' : ''}${integer}.${fraction}${currency ? ` ${currency}` : ''}`;
}
