import {
  format as formatDateFn,
  formatRelative as formatRelativeFn,
  type FormatOptions,
  type FormatRelativeOptions,
} from 'date-fns';

export type { FormatOptions, FormatRelativeOptions };

/**
 * Default date format string: "Apr 29, 2025"
 */
export const DATE_FORMAT_SHORT = 'PP';

/**
 * Default date format string: "April 29, 2025"
 */
export const DATE_FORMAT_LONG = 'PPP';

/**
 * Default date format string: "04/29/2025"
 */
export const DATE_FORMAT_NUMERIC = 'P';

/**
 * Default time format string: "12:00 AM"
 */
export const TIME_FORMAT_SHORT = 'p';

/**
 * Default time format string: "12:00:00 AM"
 */
export const TIME_FORMAT_LONG = 'pp';

/**
 * Default date-time format string: "Apr 29, 2025, 12:00 AM"
 */
export const DATETIME_FORMAT_SHORT = 'PPp';

/**
 * Default date-time format string: "April 29, 2025 at 12:00:00 AM"
 */
export const DATETIME_FORMAT_LONG = 'PPPppp';

/**
 * Admin table date-time format: "Jul 29, 2025, 10:08:35 UTC +08:00".
 *
 * Single canonical format for every admin table timestamp so columns stay
 * sortable-by-eye and consistently aligned. The UTC offset rendered is the
 * viewer's local offset (`XXX` token), i.e. the wall-clock time shown is the
 * user's local time annotated with its offset from UTC.
 */
export const DATETIME_FORMAT_ADMIN = "MMM dd, yyyy, HH:mm:ss 'UTC' XXX";

/**
 * Formats a date value in the unified admin table format
 * ("Jul 29, 2025, 10:08:35 UTC +08:00").
 *
 * @example
 * formatAdminDateTime(new Date(2025, 6, 29, 10, 8, 35)) // => "Jul 29, 2025, 10:08:35 UTC +08:00" (at UTC+8)
 */
export function formatAdminDateTime(date: Date | number | string): string {
  return formatDateFn(date, DATETIME_FORMAT_ADMIN);
}

/**
 * Converts legacy Moment-style date tokens to date-fns Unicode tokens.
 *
 * Existing migrated pages use `YYYY`/`YY`/`DD`, while date-fns rejects those
 * tokens unless they are explicitly opted into as week-numbering years or
 * day-of-year values. Calendar-year and day-of-month display formats must use
 * `yyyy`/`yy` and `dd` instead.
 */
export function normalizeDateFormat(formatStr: string): string {
  return formatStr
    .replace(/YYYY/g, 'yyyy')
    .replace(/YY/g, 'yy')
    .replace(/DD/g, 'dd');
}

/**
 * Formats a date value using date-fns with the given format string.
 *
 * @param date - The date to format (Date, number, or string)
 * @param formatStr - The format string (date-fns Unicode tokens). Defaults to {@link DATE_FORMAT_SHORT}
 * @param options - Optional date-fns format options (locale, weekStartsOn, etc.)
 * @returns The formatted date string
 *
 * @example
 * formatDate(new Date(2025, 3, 29)) // => "Apr 29, 2025"
 * formatDate(new Date(2025, 3, 29), DATE_FORMAT_LONG) // => "April 29, 2025"
 * formatDate(new Date(2025, 3, 29, 14, 30), TIME_FORMAT_SHORT) // => "2:30 PM"
 */
export function formatDate(
  date: Date | number | string,
  formatStr: string = DATE_FORMAT_SHORT,
  options?: FormatOptions,
): string {
  return formatDateFn(date, normalizeDateFormat(formatStr), options);
}

/**
 * Formats a date value as a time string.
 *
 * @param date - The date to format
 * @param formatStr - The time format string. Defaults to {@link TIME_FORMAT_SHORT}
 * @param options - Optional date-fns format options
 * @returns The formatted time string
 *
 * @example
 * formatTime(new Date(2025, 3, 29, 14, 30)) // => "2:30 PM"
 * formatTime(new Date(2025, 3, 29, 14, 30), TIME_FORMAT_LONG) // => "2:30:00 PM"
 */
export function formatTime(
  date: Date | number | string,
  formatStr: string = TIME_FORMAT_SHORT,
  options?: FormatOptions,
): string {
  return formatDateFn(date, normalizeDateFormat(formatStr), options);
}

/**
 * Formats a date relative to a base date (e.g. "yesterday", "today", "last Sunday").
 *
 * @param date - The date to format
 * @param baseDate - The reference date to compare against. Defaults to `new Date()` (now)
 * @param options - Optional date-fns formatRelative options
 * @returns The relative date string
 *
 * @example
 * formatRelative(subDays(new Date(), 1), new Date()) // => "yesterday at 2:30 PM"
 * formatRelative(addDays(new Date(), 2), new Date()) // => "Sunday at 2:30 PM"
 */
export function formatRelative(
  date: Date | number | string,
  baseDate: Date | number | string = new Date(),
  options?: FormatRelativeOptions,
): string {
  return formatRelativeFn(date, baseDate, options);
}
