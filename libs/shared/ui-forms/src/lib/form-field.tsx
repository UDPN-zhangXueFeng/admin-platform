'use client';

import * as React from 'react';

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
 * Integrates with react-hook-form via the `register` prop.
 * If `register` is provided, its properties are spread into the native input.
 * Otherwise, the component falls back to standard controlled/uncontrolled behavior.
 *
 * Why native input instead of a custom Input component?
 * - react-hook-form's `register` returns handlers optimized for native inputs.
 * - Avoids an extra layer of ref forwarding and event normalization.
 * - Keeps the bundle minimal; consumers can compose with @myorg/shared/ui Input if desired.
 */
export const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  ({ name, label, error, register, type = 'text', placeholder, required, className, ...rest }, ref) => {
    const inputId = `field-${name}`;
    const errorId = error ? `error-${name}` : undefined;

    return (
      <div className={className}>
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          {label}
          {required && <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>}
        </label>
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

/** Re-export cn for internal use so the file is self-contained. */
import { cn } from '@myorg/shared/util-classnames';
