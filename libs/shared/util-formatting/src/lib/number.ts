/**
 * Options for number formatting.
 */
export interface NumberFormatOptions {
  /** Minimum number of fraction digits. */
  minimumFractionDigits?: number;
  /** Maximum number of fraction digits. */
  maximumFractionDigits?: number;
  /** Minimum number of integer digits (pads with zeros). */
  minimumIntegerDigits?: number;
  /** Whether to group digits. Defaults to true. */
  useGrouping?: boolean;
  /** Rounding mode. Defaults to "halfEven". */
  roundingMode?: 'ceil' | 'floor' | 'expand' | 'trunc' | 'halfCeil' | 'halfFloor' | 'halfExpand' | 'halfTrunc' | 'halfEven';
  /** Notation style. Defaults to "standard". */
  notation?: 'standard' | 'scientific' | 'engineering' | 'compact';
}

/**
 * Default number format options.
 */
const DEFAULT_NUMBER_OPTIONS: Required<Pick<NumberFormatOptions, 'useGrouping' | 'notation'>> = {
  useGrouping: true,
  notation: 'standard',
};

/**
 * Formats a number using `Intl.NumberFormat` for locale-aware formatting.
 *
 * @param value - The number to format
 * @param locale - BCP 47 locale string (e.g. "en-US", "de-DE", "zh-CN")
 * @param options - Optional formatting overrides
 * @returns The formatted number string
 *
 * @example
 * formatNumber(1234567.89, 'en-US') // => "1,234,567.89"
 * formatNumber(1234567.89, 'de-DE') // => "1.234.567,89"
 * formatNumber(1234567.89, 'zh-CN') // => "1,234,567.89"
 * formatNumber(1234, 'en-US', { notation: 'compact' }) // => "1.2K"
 */
export function formatNumber(
  value: number,
  locale: string,
  options?: NumberFormatOptions,
): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: 'decimal',
    useGrouping: options?.useGrouping ?? DEFAULT_NUMBER_OPTIONS.useGrouping,
    notation: options?.notation ?? DEFAULT_NUMBER_OPTIONS.notation,
    minimumFractionDigits: options?.minimumFractionDigits,
    maximumFractionDigits: options?.maximumFractionDigits,
    minimumIntegerDigits: options?.minimumIntegerDigits,
    roundingMode: options?.roundingMode,
  });

  return formatter.format(value);
}

/**
 * Formats a number as a percentage string.
 *
 * By default, the value is multiplied by 100 (e.g. 0.15 -> "15%").
 * Pass `alreadyMultiplied: true` if the value is already in percentage form.
 *
 * @param value - The number to format
 * @param locale - BCP 47 locale string
 * @param options - Optional formatting overrides
 * @returns The formatted percentage string
 *
 * @example
 * formatPercentage(0.1567, 'en-US') // => "15.67%"
 * formatPercentage(0.1567, 'en-US', { maximumFractionDigits: 1 }) // => "15.7%"
 * formatPercentage(15.67, 'en-US', { alreadyMultiplied: true }) // => "15.67%"
 */
export function formatPercentage(
  value: number,
  locale: string,
  options?: NumberFormatOptions & { alreadyMultiplied?: boolean },
): string {
  const rawValue = options?.alreadyMultiplied ? value : value * 100;

  const formatter = new Intl.NumberFormat(locale, {
    style: 'percent',
    useGrouping: options?.useGrouping ?? DEFAULT_NUMBER_OPTIONS.useGrouping,
    minimumFractionDigits: options?.minimumFractionDigits,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
    minimumIntegerDigits: options?.minimumIntegerDigits,
    roundingMode: options?.roundingMode,
  });

  // When using style: 'percent', Intl.NumberFormat automatically multiplies by 100.
  // If alreadyMultiplied is true, we need to divide by 100 before passing to formatter.
  const inputValue = options?.alreadyMultiplied ? rawValue / 100 : value;

  return formatter.format(inputValue);
}
