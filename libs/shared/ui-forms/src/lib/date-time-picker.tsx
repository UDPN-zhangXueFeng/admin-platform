'use client';

import * as React from 'react';
import { enUS } from 'date-fns/locale';
import { CalendarDays } from 'lucide-react';
import { DayFlag, DayPicker, SelectionState, UI } from 'react-day-picker';

import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';
import { cn } from '@myorg/shared/util-classnames';

export interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  ariaLabel?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
  register?: {
    name: string;
    ref: React.RefCallback<HTMLInputElement>;
  };
}

function parseDateTime(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [, year, month, day, hour, minute] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day) &&
    Number(hour) <= 23 &&
    Number(minute) <= 59
    ? date
    : undefined;
}

function toIso(date: Date, hour: string, minute: string): string {
  return (
    date.getFullYear() +
    '-' +
    String(date.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(date.getDate()).padStart(2, '0') +
    'T' +
    hour +
    ':' +
    minute
  );
}

function displayValue(value: string): string {
  const date = parseDateTime(value);
  if (!date) return '';
  const match = /T(\d{2}):(\d{2})$/.exec(value);
  return (
    String(date.getMonth() + 1).padStart(2, '0') +
    '/' +
    String(date.getDate()).padStart(2, '0') +
    '/' +
    date.getFullYear() +
    ' ' +
    (match?.[1] ?? '00') +
    ':' +
    (match?.[2] ?? '00')
  );
}

const timeOptions = (max: number) =>
  Array.from({ length: max + 1 }, (_, index) => String(index).padStart(2, '0'));

const hours = timeOptions(23);
const minutes = timeOptions(59);

export function DateTimePicker({
  value,
  onChange,
  id,
  name,
  ariaLabel = 'Select date and time',
  ariaInvalid,
  ariaDescribedBy,
  disabled,
  min,
  max,
  className,
  register,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [currentValue, setCurrentValue] = React.useState(value);
  React.useEffect(() => setCurrentValue(value), [value]);
  const selected = parseDateTime(currentValue);
  const [hour, minute] = currentValue.match(/T(\d{2}):(\d{2})$/)?.slice(1) ?? ['00', '00'];
  const minDate = parseDateTime(min ?? '')?.setHours(0, 0, 0, 0);
  const maxDate = parseDateTime(max ?? '')?.setHours(0, 0, 0, 0);

  const emit = (date: Date, nextHour = hour, nextMinute = minute) => {
    const nextValue = toIso(date, nextHour, nextMinute);
    setCurrentValue(nextValue);
    onChange(nextValue);
  };

  return (
    <div className="relative">
      <input
        type="hidden"
        name={register?.name ?? name}
        value={currentValue}
        ref={register?.ref}
        readOnly
        aria-hidden="true"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={ariaLabel}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className={cn(
              'h-10 w-full justify-between px-3 font-normal',
              !selected && 'text-muted-foreground',
              className,
            )}
          >
            <span>{displayValue(currentValue) || 'MM/DD/YYYY HH:mm'}</span>
            <CalendarDays className="text-muted-foreground" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <DayPicker
            mode="single"
            locale={enUS}
            selected={selected}
            defaultMonth={selected}
            onSelect={(date) => date && emit(date)}
            disabled={(date) =>
              Boolean(
                (minDate && date.getTime() < minDate) ||
                  (maxDate && date.getTime() > maxDate),
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
          <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3">
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              Hour
              <Select
                value={hour}
                onValueChange={(nextHour) => selected && emit(selected, nextHour, minute)}
                disabled={!selected || disabled}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>{hours.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              Minute
              <Select
                value={minute}
                onValueChange={(nextMinute) => selected && emit(selected, hour, nextMinute)}
                disabled={!selected || disabled}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>{minutes.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </label>
          </div>
          {selected && (
            <Button type="button" variant="ghost" size="sm" className="mt-2 w-full" onClick={() => { setCurrentValue(''); onChange(''); }}>
              Clear date and time
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
