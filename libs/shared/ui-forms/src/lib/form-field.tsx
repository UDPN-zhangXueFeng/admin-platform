'use client';

import * as React from 'react';
import { DateTimePicker } from './date-time-picker';
import { cn } from '@myorg/shared/util-classnames';

export interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Field name - used for form registration and id generation */
  name: string;
  /** Visible label text */
  label: string;
  /** Error message to display below the input */
  error?: string;
  /** react-hook-form register function result - spread into input */
  register?: {
    name: string;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
    ref: React.RefCallback<HTMLInputElement>;
  };
  /** Input type (text, email, password, etc.) */
  type?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the field is required - appends asterisk to label */
  required?: boolean;
}

/**
 * FormField - Label + Input + error message wrapper.
 *
 * datetime-local fields use the shared Radix date-time picker so their
 * visible calendar and time controls are always English, independent of the
 * browser locale. The submitted value remains YYYY-MM-DDTHH:mm.
 */
export const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  ({ name, label, error, register, type = 'text', placeholder, required, className, ...rest }, ref) => {
    const inputId = `field-${name}`;
    const errorId = error ? `error-${name}` : undefined;
    const dateTimeValue =
      typeof rest.defaultValue === 'string' ? rest.defaultValue : '';

    return (
      <div className={className}>
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          {label}
          {required && <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>}
        </label>
        {type === 'datetime-local' ? (
          <DateTimePicker
            id={inputId}
            name={name}
            value={dateTimeValue}
            ariaLabel={label}
            ariaInvalid={!!error}
            ariaDescribedBy={errorId}
            disabled={rest.disabled}
            min={typeof rest.min === 'string' ? rest.min : undefined}
            max={typeof rest.max === 'string' ? rest.max : undefined}
            className={error ? 'border-destructive focus-visible:ring-destructive' : undefined}
            register={register}
            onChange={(value) =>
              register?.onChange({
                target: { name: register.name, value },
              } as React.ChangeEvent<HTMLInputElement>)
            }
          />
        ) : (
          <input
            id={inputId}
            type={type}
            placeholder={placeholder}
            aria-invalid={!!error}
            aria-describedby={errorId}
            className={cn(
              'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-destructive focus:ring-destructive'
            )}
            {...(register ?? { name })}
            {...rest}
            ref={register ? mergeRefs(register.ref, ref) : ref}
          />
        )}
        {error && (
          <p id={errorId} className="mt-1 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
FormField.displayName = 'FormField';

/** Merge a callback ref with a forwarded ref. */
function mergeRefs<T>(
  callbackRef: React.RefCallback<T>,
  forwardedRef: React.ForwardedRef<T>
): React.RefCallback<T> {
  return (value: T | null) => {
    callbackRef(value);
    if (typeof forwardedRef === 'function') {
      forwardedRef(value);
    } else if (forwardedRef) {
      forwardedRef.current = value;
    }
  };
}
