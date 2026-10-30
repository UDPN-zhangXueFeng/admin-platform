import { formatAdminDateTime, formatDate } from '@myorg/shared/util-dates';

/**
 * Admin portal time display — mirrors kissen-admin's convention.
 *
 * Every audit/business timestamp in the admin portal is rendered through
 * `formatAdminDateTime` ("Oct 30, 2026, 14:23:45 (UTC+8)") so the format is
 * deterministic across pages and columns, and the offset follows the viewer's
 * timezone instead of a hard-coded UTC+8 label.
 *
 * The helpers below only own the empty/invalid-value policy that used to be
 * duplicated per page; the actual formatting always comes from
 * `@myorg/shared/util-dates`.
 */

/** Placeholder used by admin tables/details for a missing timestamp. */
export const EMPTY_ADMIN_TIME = '--';

/** Milliseconds since epoch for numbers, numeric strings and Date values. */
function toDate(value: number | string | Date): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return numeric > 0 ? new Date(numeric) : null;
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return value > 0 ? new Date(value) : null;
}

/**
 * Timestamp → kissen-admin display format ("Oct 30, 2026, 14:23:45 (UTC+8)").
 *
 * 0 / empty / non-numeric / invalid dates all fall back to {@link EMPTY_ADMIN_TIME}.
 */
export function formatAdminTimestamp(
  value?: number | string | Date | null,
): string {
  if (value === null || value === undefined) return EMPTY_ADMIN_TIME;
  const date = toDate(value);
  return date ? formatAdminDateTime(date) : EMPTY_ADMIN_TIME;
}

/**
 * Date-only field → locale-independent `YYYY-MM-DD`.
 *
 * Used for calendar-day business fields (effective dates, statistics days);
 * true timestamps must use {@link formatAdminTimestamp}.
 */
export function formatAdminDate(
  value?: number | string | Date | null,
): string {
  if (value === null || value === undefined) return EMPTY_ADMIN_TIME;
  const date = toDate(value);
  return date ? formatDate(date, 'YYYY-MM-DD') : EMPTY_ADMIN_TIME;
}
