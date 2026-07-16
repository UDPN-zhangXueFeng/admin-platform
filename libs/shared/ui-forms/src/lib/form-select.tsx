'use client';

import * as React from 'react';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';

export interface SelectOption {
  value: string;
  label: string;
}

export interface FormSelectProps<TFieldValues extends FieldValues = FieldValues> {
  /** Field name - must match a key in the form schema */
  name: Path<TFieldValues>;
  /** react-hook-form Control instance */
  control: Control<TFieldValues>;
  /** Visible label text */
  label: string;
  /** Select options */
  options: SelectOption[];
  /** Error message to display */
  error?: string;
  /** Placeholder shown when no value is selected */
  placeholder?: string;
  /** Whether the field is required - appends asterisk to label */
  required?: boolean;
  /** Disables the select */
  disabled?: boolean;
}

/**
 * FormSelect - Select field wired to react-hook-form via Controller.
 *
 * Uses @myorg/shared/ui Select (Radix UI primitive) for consistent styling
 * and accessibility. Controller is required because Radix Select manages
 * its own internal state and does not expose a native change event.
 */
export function FormSelect<TFieldValues extends FieldValues = FieldValues>({
  name,
  control,
  label,
  options,
  error,
  placeholder = 'Select an option',
  required,
  disabled,
}: FormSelectProps<TFieldValues>) {
  const selectId = `select-${name}`;
  const errorId = error ? `error-${name}` : undefined;

  // 下拉选项预处理（两层防御后端脏数据）：
  // ① 过滤空 value——Radix Select 契约禁止 SelectItem value=""（空串保留给清除选择/
  //    显示 placeholder）。后端下拉（如 stablecoin/blockchain list）可能返回空 id 项，
  //    不过滤会运行时崩溃 "A <Select.Item /> must have a value prop that is not an empty string"。
  // ② 按 value 去重——防御后端重复 value（如多个同名用户、重复 code）导致 React key 重复
  //    warning 与 Radix Select 选中歧义。保留首次出现的项。
  const uniqueOptions = React.useMemo(() => {
    const seen = new Set<string>();
    return options.filter((opt) => {
      if (opt.value == null || opt.value === '') return false;
      if (seen.has(opt.value)) return false;
      seen.add(opt.value);
      return true;
    });
  }, [options]);

  return (
    <div>
      <label
        htmlFor={selectId}
        className="mb-1.5 block text-sm font-medium text-foreground"
      >
        {label}
        {required && <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>}
      </label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Select
            value={field.value}
            onValueChange={field.onChange}
            disabled={disabled}
          >
            <SelectTrigger
              id={selectId}
              aria-invalid={!!error}
              aria-describedby={errorId}
              className={error ? 'border-destructive focus:ring-destructive' : undefined}
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {uniqueOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
