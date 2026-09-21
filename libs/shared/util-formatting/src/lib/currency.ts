/**
 * Options for currency formatting.
 */
export interface CurrencyFormatOptions {
  /** Minimum number of fraction digits. Defaults to 2 for most currencies. */
  minimumFractionDigits?: number;
  /** Maximum number of fraction digits. Defaults to 2 for most currencies. */
  maximumFractionDigits?: number;
  /** Whether to group digits (e.g. 1,000 vs 1000). Defaults to true. */
  useGrouping?: boolean;
  /** How to display the currency. Defaults to "symbol". */
  currencyDisplay?: 'symbol' | 'narrowSymbol' | 'code' | 'name';
  /** Rounding mode. Defaults to "halfEven". */
  roundingMode?: 'ceil' | 'floor' | 'expand' | 'trunc' | 'halfCeil' | 'halfFloor' | 'halfExpand' | 'halfTrunc' | 'halfEven';
}

/**
 * Default currency format options.
 */
const DEFAULT_CURRENCY_OPTIONS: Required<Pick<CurrencyFormatOptions, 'useGrouping' | 'currencyDisplay'>> = {
  useGrouping: true,
  currencyDisplay: 'symbol',
};

/**
 * Formats a numeric amount as a localized currency string using `Intl.NumberFormat`.
 *
 * @param amount - The numeric amount to format
 * @param locale - BCP 47 locale string (e.g. "en-US", "zh-CN", "de-DE")
 * @param currency - ISO 4217 currency code (e.g. "USD", "CNY", "EUR")
 * @param options - Optional formatting overrides
 * @returns The formatted currency string
 *
 * @example
 * formatCurrency(1234.5, 'en-US', 'USD') // => "$1,234.50"
 * formatCurrency(1234.5, 'de-DE', 'EUR') // => "1.234,50 €"
 * formatCurrency(1234.5, 'zh-CN', 'CNY') // => "¥1,234.50"
 * formatCurrency(1234.5, 'ja-JP', 'JPY') // => "￥1,235" (no decimals for JPY)
 */
export function formatCurrency(
  amount: number,
  locale: string,
  currency: string,
  options?: CurrencyFormatOptions,
): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: options?.currencyDisplay ?? DEFAULT_CURRENCY_OPTIONS.currencyDisplay,
    useGrouping: options?.useGrouping ?? DEFAULT_CURRENCY_OPTIONS.useGrouping,
    minimumFractionDigits: options?.minimumFractionDigits,
    maximumFractionDigits: options?.maximumFractionDigits,
    roundingMode: options?.roundingMode,
  });

  return formatter.format(amount);
}

/**
 * Formats a numeric amount as a compact currency string (e.g. "$1.2K", "¥12万").
 *
 * @param amount - The numeric amount to format
 * @param locale - BCP 47 locale string
 * @param currency - ISO 4217 currency code
 * @param options - Optional formatting overrides
 * @returns The compact formatted currency string
 *
 * @example
 * formatCompactCurrency(1234, 'en-US', 'USD') // => "$1.2K"
 * formatCompactCurrency(1234567, 'zh-CN', 'CNY') // => "¥123万"
 */
export function formatCompactCurrency(
  amount: number,
  locale: string,
  currency: string,
  options?: Omit<CurrencyFormatOptions, 'currencyDisplay'>,
): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    useGrouping: options?.useGrouping ?? DEFAULT_CURRENCY_OPTIONS.useGrouping,
    minimumFractionDigits: options?.minimumFractionDigits,
    maximumFractionDigits: options?.maximumFractionDigits ?? 1,
    roundingMode: options?.roundingMode,
  });

  return formatter.format(amount);
}
