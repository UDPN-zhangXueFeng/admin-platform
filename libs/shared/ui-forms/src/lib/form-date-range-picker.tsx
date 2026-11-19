'use client';

import { useController, type Control, type FieldValues, type Path } from 'react-hook-form';
import { DateRangePicker } from './date-range-picker';

export interface FormDateRangePickerProps<TFieldValues extends FieldValues = FieldValues> {
  /** Form field holding the range start (`YYYY-MM-DD` string). */
  startName: Path<TFieldValues>;
  /** Form field holding the range end (`YYYY-MM-DD` string). */
  endName: Path<TFieldValues>;
  /** react-hook-form Control instance */
  control: Control<TFieldValues>;
  /** Visible label text for the whole range */
  label: string;
  /** Hides the local label when a parent fieldset already supplies one. */
  hideLabel?: boolean;
  /** Error message to display (pass whichever of start/end errors applies) */
  error?: string;
  startPlaceholder?: string;
  endPlaceholder?: string;
  /** Whether the field is required - appends asterisk to label */
  required?: boolean;
  disabled?: boolean;
  /** Minimum allowed date (ISO string) */
  min?: string;
  /** Maximum allowed date (ISO string) */
  max?: string;
}

/**
 * FormDateRangePicker - one `start → end` date range input wired to two
 * react-hook-form fields. Each field stays a `YYYY-MM-DD` string, so schemas
 * and API mappers written for paired FormDatePickers keep working.
 */
export function FormDateRangePicker<TFieldValues extends FieldValues = FieldValues>({
  startName,
  endName,
  control,
  label,
  hideLabel,
  error,
  startPlaceholder,
  endPlaceholder,
  required,
  disabled,
  min,
  max,
}: FormDateRangePickerProps<TFieldValues>) {
  const { field: startField } = useController({ name: startName, control });
  const { field: endField } = useController({ name: endName, control });
  const inputId = `date-range-${startName}`;
  const errorId = error ? `error-${startName}` : undefined;

  return (
    <div>
      {!hideLabel && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          {label}
          {required && <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>}
        </label>
      )}
      <DateRangePicker
        id={inputId}
        value={{
          start: typeof startField.value === 'string' ? startField.value : '',
          end: typeof endField.value === 'string' ? endField.value : '',
        }}
        onChange={({ start, end }) => {
          startField.onChange(start);
          endField.onChange(end);
        }}
        startPlaceholder={startPlaceholder}
        endPlaceholder={endPlaceholder}
        ariaLabel={label}
        ariaInvalid={!!error}
        ariaDescribedBy={errorId}
        disabled={disabled}
        min={min}
        max={max}
        className={error ? 'border-destructive focus-visible:ring-destructive' : undefined}
      />
      {error && (
        <p id={errorId} className="mt-1 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
