'use client';

import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { DatePicker } from './date-picker';

export interface FormDatePickerProps<TFieldValues extends FieldValues = FieldValues> {
  /** Field name - must match a key in the form schema */
  name: Path<TFieldValues>;
  /** react-hook-form Control instance */
  control: Control<TFieldValues>;
  /** Visible label text */
  label: string;
  /** Hides the local label when a parent fieldset already supplies one. */
  hideLabel?: boolean;
  /** Error message to display */
  error?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the field is required - appends asterisk to label */
  required?: boolean;
  /** Disables the input */
  disabled?: boolean;
  /** Minimum allowed date (ISO string) */
  min?: string;
  /** Maximum allowed date (ISO string) */
  max?: string;
}

/**
 * FormDatePicker - locale-controlled date picker wired to react-hook-form.
 *
 * Form state remains a `YYYY-MM-DD` string so API mappers are unaffected.
 */
export function FormDatePicker<TFieldValues extends FieldValues = FieldValues>({
  name,
  control,
  label,
  hideLabel,
  error,
  placeholder,
  required,
  disabled,
  min,
  max,
}: FormDatePickerProps<TFieldValues>) {
  const inputId = `date-${name}`;
  const errorId = error ? `error-${name}` : undefined;

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
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <DatePicker
            id={inputId}
            value={typeof field.value === 'string' ? field.value : ''}
            onChange={field.onChange}
            placeholder={placeholder}
            ariaLabel={label}
            ariaInvalid={!!error}
            ariaDescribedBy={errorId}
            disabled={disabled}
            min={min}
            max={max}
            className={error ? 'border-destructive focus-visible:ring-destructive' : undefined}
          />
        )}
      />
      {error && (
        <p id={errorId} className="mt-1 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
