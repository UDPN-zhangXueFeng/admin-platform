'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { cn } from '../utils';
import { Button } from '../button';
import { Input, type InputProps } from '../input';

/**
 * Props for {@link PasswordField}. Identical to `InputProps` except `type`,
 * which the component controls: `password` while hidden, `text` while shown.
 */
export type PasswordFieldProps = Omit<InputProps, 'type'> & {
  /**
   * Accessible name of the toggle while the password is hidden.
   * Defaults to the English "Show password"; pass a translated string in
   * bilingual applications.
   */
  showLabel?: string;
  /**
   * Accessible name of the toggle while the password is visible.
   * Defaults to the English "Hide password".
   */
  hideLabel?: string;
};

/**
 * Password input with a visibility toggle button.
 *
 * Wraps {@link Input} and overlays a ghost icon button (Eye / EyeOff from
 * lucide-react) on the right edge that flips the underlying input between
 * `password` and `text`. All remaining `Input` props — including `ref`, so
 * react-hook-form `register` spreads work unchanged — pass through untouched.
 *
 * @example
 * <PasswordField id="password" showLabel="显示密码" hideLabel="隐藏密码" />
 */
const PasswordField = React.forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ className, showLabel = 'Show password', hideLabel = 'Hide password', ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);

    return (
      <div className="relative">
        <Input
          type={visible ? 'text' : 'password'}
          className={cn('pr-10', className)}
          ref={ref}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute inset-y-0 right-0 h-auto w-10 rounded-l-none text-muted-foreground hover:text-accent-foreground"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          disabled={props.disabled}
        >
          {visible ? <EyeOff /> : <Eye />}
        </Button>
      </div>
    );
  }
);
PasswordField.displayName = 'PasswordField';

export { PasswordField };
