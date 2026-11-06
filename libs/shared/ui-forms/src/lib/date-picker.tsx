'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { enUS, zhCN } from 'date-fns/locale';
import { CalendarDays } from 'lucide-react';
import { useLocale } from 'next-intl';
import { DayPicker, SelectionState } from 'react-day-picker';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@myorg/shared/ui';
import { cn } from '@myorg/shared/util-classnames';
import { calendarClassNames, parseDate } from './calendar-utils';

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
            ...calendarClassNames,
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
