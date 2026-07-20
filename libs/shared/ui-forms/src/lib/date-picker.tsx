'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { enUS, zhCN } from 'date-fns/locale';
import { CalendarDays } from 'lucide-react';
import { useLocale } from 'next-intl';
import {
  DayFlag,
  DayPicker,
  SelectionState,
  UI,
} from 'react-day-picker';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@myorg/shared/ui';
import { cn } from '@myorg/shared/util-classnames';

export interface DatePickerProps {
  /** ISO calendar date (`YYYY-MM-DD`), independent of the displayed locale. */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  ariaLabel?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
}

function parseDate(value?: string): Date | undefined {
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

/**
 * Locale-controlled calendar input.
 *
 * The value remains an ISO date so existing form state and API mappers stay
 * stable; only the calendar and display format follow the active route locale.
 */
export function DatePicker({
  value,
  onChange,
  id,
  placeholder,
  ariaLabel,
  ariaInvalid,
  ariaDescribedBy,
  disabled,
  min,
  max,
  className,
}: DatePickerProps) {
  const locale = useLocale();
  const [open, setOpen] = React.useState(false);
  const selected = parseDate(value);
  const minDate = parseDate(min);
  const maxDate = parseDate(max);
  const isChinese = locale === 'zh-CN';
  const calendarLocale = isChinese ? zhCN : enUS;
  const displayValue = selected
    ? format(selected, 'P', { locale: calendarLocale })
    : placeholder ?? (isChinese ? 'YYYY/MM/DD' : 'MM/DD/YYYY');
  const clearLabel = isChinese ? '清除日期' : 'Clear date';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel ?? displayValue}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          className={cn(
            'h-10 w-full justify-between px-3 font-normal',
            !selected && 'text-muted-foreground',
            className
          )}
        >
          <span className="truncate">{displayValue}</span>
          <CalendarDays className="text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <DayPicker
          mode="single"
          locale={calendarLocale}
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            onChange(date ? format(date, 'yyyy-MM-dd') : '');
            setOpen(false);
          }}
          disabled={(date) =>
            Boolean(
              (minDate && date < minDate) || (maxDate && date > maxDate)
            )
          }
          classNames={{
            [UI.Root]: 'relative',
            [UI.Months]: 'flex',
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
            [SelectionState.selected]: 'rounded-md bg-primary text-primary-foreground',
          }}
        />
        {selected && (
          <div className="mt-2 flex justify-end border-t pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange('');
                setOpen(false);
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
