'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { enUS, zhCN } from 'date-fns/locale';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { useLocale } from 'next-intl';
import { DayPicker, SelectionState, type DateRange } from 'react-day-picker';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@myorg/shared/ui';
import { cn } from '@myorg/shared/util-classnames';
import { calendarClassNames, parseDate } from './calendar-utils';

export interface DateRangeValue {
  /** ISO calendar date (`YYYY-MM-DD`) or empty string. */
  start: string;
  /** ISO calendar date (`YYYY-MM-DD`) or empty string. */
  end: string;
}

export interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  id?: string;
  startPlaceholder?: string;
  endPlaceholder?: string;
  ariaLabel?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
}

/**
 * Locale-controlled date range input: one trigger shows `start → end`, one
 * popover picks both ends (first click = start, second click = end; picks are
 * reordered when the second date precedes the first).
 *
 * Values stay ISO `YYYY-MM-DD` strings so the start/end form fields and API
 * mappers are unchanged. An unfinished pick (only one date clicked) is
 * discarded when the popover closes.
 */
export function DateRangePicker({
  value,
  onChange,
  id,
  startPlaceholder,
  endPlaceholder,
  ariaLabel,
  ariaInvalid,
  ariaDescribedBy,
  disabled,
  min,
  max,
  className,
}: DateRangePickerProps) {
  const locale = useLocale();
  const [open, setOpen] = React.useState(false);
  /** First date of an in-progress pick; null when no pick is pending. */
  const [pendingStart, setPendingStart] = React.useState<Date | null>(null);

  const start = parseDate(value.start);
  const end = parseDate(value.end);
  const minDate = parseDate(min);
  const maxDate = parseDate(max);
  const isChinese = locale === 'zh-CN';
  const calendarLocale = isChinese ? zhCN : enUS;
  const startText = start
    ? format(start, 'P', { locale: calendarLocale })
    : startPlaceholder ?? (isChinese ? '开始日期' : 'Start date');
  const endText = end
    ? format(end, 'P', { locale: calendarLocale })
    : endPlaceholder ?? (isChinese ? '结束日期' : 'End date');
  const clearLabel = isChinese ? '清除日期' : 'Clear date';
  const selected: DateRange | undefined = pendingStart
    ? { from: pendingStart, to: undefined }
    : start || end
      ? { from: start ?? end, to: end ?? start }
      : undefined;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setPendingStart(null);
  };

  const handleDayClick = (date: Date) => {
    if (!pendingStart) {
      setPendingStart(date);
      return;
    }
    const [from, to] = date < pendingStart ? [date, pendingStart] : [pendingStart, date];
    onChange({ start: format(from, 'yyyy-MM-dd'), end: format(to, 'yyyy-MM-dd') });
    handleOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel ? `${ariaLabel}: ${startText} - ${endText}` : `${startText} - ${endText}`}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          className={cn('h-10 w-full justify-between gap-2 px-3 font-normal', className)}
        >
          <span className={cn('min-w-0 flex-1 truncate text-left', !start && 'text-muted-foreground')}>
            {startText}
          </span>
          <ArrowRight className="shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className={cn('min-w-0 flex-1 truncate text-left', !end && 'text-muted-foreground')}>
            {endText}
          </span>
          <CalendarDays className="shrink-0 text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <DayPicker
          mode="range"
          numberOfMonths={2}
          locale={calendarLocale}
          selected={selected}
          defaultMonth={start ?? end}
          onSelect={(_range, triggerDate) => handleDayClick(triggerDate)}
          disabled={(date) =>
            Boolean(
              (minDate && date < minDate) || (maxDate && date > maxDate)
            )
          }
          classNames={{
            ...calendarClassNames,
            [SelectionState.range_start]: 'rounded-l-md bg-primary text-primary-foreground',
            [SelectionState.range_end]: 'rounded-r-md bg-primary text-primary-foreground',
            [SelectionState.range_middle]: 'rounded-none bg-accent text-accent-foreground',
          }}
        />
        {(start || end) && (
          <div className="mt-2 flex justify-end border-t pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange({ start: '', end: '' });
                handleOpenChange(false);
              }}
            >
              {clearLabel}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
