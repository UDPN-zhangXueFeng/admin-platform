import { formatAdminTimestamp } from '../format-admin-time';

export function formatEodCutoffTime(value?: string | number | null, timeZone?: string | null): string {
  const text = value == null ? '' : String(value).trim();
  if (!text || text === '--') return '--';
  if (!timeZone?.trim()) return text;
  try {
    const offset = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone.trim(),
      timeZoneName: 'shortOffset',
    }).formatToParts().find((part) => part.type === 'timeZoneName')?.value;
    return offset ? `${text} (${offset.replace(/^GMT$/, 'GMT+0').replace('GMT', 'UTC')})` : text;
  } catch {
    return text;
  }
}

export function formatLastEodPostingRun(value?: string | number | null): string {
  if (typeof value === 'number' || /^\d{10}(?:\d{3})?$/.test(value?.trim() ?? '')) {
    return formatAdminTimestamp(value);
  }
  return value?.trim() || '--';
}
