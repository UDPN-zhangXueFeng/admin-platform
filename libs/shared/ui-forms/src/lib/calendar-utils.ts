import { DayFlag, UI } from 'react-day-picker';

/** Parses an ISO calendar date (`YYYY-MM-DD`) as a local date; invalid input yields undefined. */
export function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day)
    ? date
    : undefined;
}

/** Shared DayPicker class names; selection-state classes are supplied per picker mode. */
export const calendarClassNames = {
  [UI.Root]: 'relative',
  [UI.Months]: 'flex gap-4',
  [UI.Month]: 'space-y-2',
  [UI.MonthCaption]: 'flex h-9 items-center justify-center',
  [UI.CaptionLabel]: 'text-sm font-semibold',
  [UI.Nav]: 'absolute inset-x-0 top-0 flex items-center justify-between',
  [UI.PreviousMonthButton]: 'inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent',
  [UI.NextMonthButton]: 'inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent',
  [UI.Chevron]: 'h-4 w-4',
  [UI.MonthGrid]: 'w-full border-collapse',
  [UI.Weekdays]: 'text-muted-foreground',
  [UI.Weekday]: 'h-8 w-9 text-center text-xs font-normal',
  [UI.Week]: 'h-9',
  [UI.Day]: 'h-9 w-9 p-0 text-center',
  [UI.DayButton]: 'h-9 w-9 rounded-md text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  [DayFlag.today]: 'font-semibold text-primary',
  [DayFlag.outside]: 'text-muted-foreground opacity-50',
  [DayFlag.disabled]: 'text-muted-foreground opacity-40',
};
