'use client';

import { useController, type Control, type FieldValues, type Path } from 'react-hook-form';
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@myorg/shared/ui';
import { X } from 'lucide-react';
import { ALL_VALUE } from './journal-entries-new.constants';

interface JournalFilterSelectProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  options: { value: string; label: string; disabled?: boolean }[];
  clearLabel?: string;
}

/** The shared FormSelect does not expose per-option disabling or a clear action. */
export function JournalFilterSelect<T extends FieldValues>({ control, name, label, options, clearLabel }: JournalFilterSelectProps<T>) {
  const { field } = useController({ control, name });
  const id = `journal-filter-${name}`;
  const seen = new Set<string>();

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      <div className="flex items-center gap-1">
        <Select value={field.value} onValueChange={field.onChange}>
          <SelectTrigger id={id} ref={field.ref} onBlur={field.onBlur} className="min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map(({ value, label, disabled }) => {
              if (!value || seen.has(value)) return null;
              seen.add(value);
              return <SelectItem key={value} value={value} disabled={disabled}>{label}</SelectItem>;
            })}
          </SelectContent>
        </Select>
        {clearLabel && field.value !== ALL_VALUE && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={clearLabel}
            title={clearLabel}
            onClick={() => {
              field.onChange(ALL_VALUE);
              document.getElementById(id)?.focus();
            }}
          >
            <X aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
