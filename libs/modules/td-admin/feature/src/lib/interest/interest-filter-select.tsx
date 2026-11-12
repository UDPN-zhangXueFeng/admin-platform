'use client';

import * as React from 'react';
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from 'react-hook-form';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';

export interface InterestFilterSelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface InterestFilterSelectProps<TFieldValues extends FieldValues> {
  name: Path<TFieldValues>;
  control: Control<TFieldValues>;
  label: string;
  options: InterestFilterSelectOption[];
  placeholder?: string;
  idPrefix?: string;
}

/**
 * 筛选下拉（逐项 disabled 透传）。
 *
 * `FormSelect` 的 options 类型与渲染均不携带 `disabled`，而 `useBlockchainOptions`
 * 会按 `status !== 1` 标记停用链。此组件直接使用 Radix `SelectItem` 原生
 * disabled，使停用链保持可见但不可选（对齐 td-manage accrual/transactions 的
 * `options.disabled` 行为）。
 */
export function InterestFilterSelect<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  options,
  placeholder,
  idPrefix = 'interest-filter',
}: InterestFilterSelectProps<TFieldValues>) {
  const selectId = `${idPrefix}-${String(name)}`;
  // Radix Select 禁止空 value；同时按 value 去重避免重复 key。
  const uniqueOptions = React.useMemo(() => {
    const seen = new Set<string>();
    return options.filter((opt) => {
      if (!opt.value) return false;
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
      </label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger id={selectId}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {uniqueOptions.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.disabled}
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </div>
  );
}
