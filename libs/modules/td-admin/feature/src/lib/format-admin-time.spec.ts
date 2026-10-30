import { formatAdminDateTime } from '@myorg/shared/util-dates';
import {
  EMPTY_ADMIN_TIME,
  formatAdminDate,
  formatAdminTimestamp,
} from './format-admin-time';

describe('format-admin-time', () => {
  const sample = new Date(2026, 9, 30, 14, 23, 45).getTime();

  it('renders timestamps with the kissen-admin format including the viewer offset', () => {
    expect(formatAdminTimestamp(sample)).toBe(formatAdminDateTime(new Date(sample)));
    expect(formatAdminTimestamp(sample)).toMatch(/\(UTC[+-]\d+(:\d{2})?\)$/);
  });

  it('accepts numeric strings and Date values because backend payloads are not typed', () => {
    expect(formatAdminTimestamp(String(sample))).toBe(formatAdminDateTime(new Date(sample)));
    expect(formatAdminTimestamp(new Date(sample))).toBe(formatAdminDateTime(new Date(sample)));
  });

  it('falls back to the shared placeholder for missing or invalid values', () => {
    expect(formatAdminTimestamp(undefined)).toBe(EMPTY_ADMIN_TIME);
    expect(formatAdminTimestamp(null)).toBe(EMPTY_ADMIN_TIME);
    expect(formatAdminTimestamp('')).toBe(EMPTY_ADMIN_TIME);
    expect(formatAdminTimestamp(0)).toBe(EMPTY_ADMIN_TIME);
    expect(formatAdminTimestamp('not-a-date')).toBe(EMPTY_ADMIN_TIME);
  });

  it('keeps date-only fields as locale-independent calendar days', () => {
    expect(formatAdminDate(sample)).toBe('2026-10-30');
    expect(formatAdminDate(undefined)).toBe(EMPTY_ADMIN_TIME);
  });
});
