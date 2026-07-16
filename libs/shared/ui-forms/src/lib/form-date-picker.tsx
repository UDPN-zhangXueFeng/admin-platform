'use client';

import * as React from 'react';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { cn } from '@myorg/shared/util-classnames';

export interface FormDatePickerProps<TFieldValues extends FieldValues = FieldValues> {
  /** Field name - must match a key in the form schema */
  name: Path<TFieldValues>;
  /** react-hook-form Control instance */
  control: Control<TFieldValues>;
  /** Visible label text */
  label: string;
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
 * FormDatePicker - Date input wired to react-hook-form via Controller.
 *
 * Uses a native HTML date input (`type="date"`) for maximum compatibility,
 * zero bundle overhead, and built-in mobile keyboard support.
 *
 * Why native over a custom date picker?
 * - No extra dependencies (date-fns, react-day-picker, etc.).
 * - Accessible out of the box on all platforms.
 * - react-hook-form works seamlessly with native inputs.
 *
 * If a richer UX (calendar popover, range selection) is needed later,
 * swap this for a Radix-based date picker without changing the public API.
 */
export function FormDatePicker<TFieldValues extends FieldValues = FieldValues>({
  name,
  control,
  label,
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
      <label
        htmlFor={inputId}
        className="mb-1.5 block text-sm font-medium text-foreground"
      >
        {label}
        {required && <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>}
      </label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <input
            {...field}
            id={inputId}
            type="date"
            placeholder={placeholder}
            disabled={disabled}
            min={min}
            max={max}
            aria-invalid={!!error}
            aria-describedby={errorId}
            className={cn(
              'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-destructive focus:ring-destructive'
            )}
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
