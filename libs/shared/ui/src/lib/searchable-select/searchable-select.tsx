'use client';

import * as React from 'react';
import { Command } from 'cmdk';
import { Check, ChevronsUpDown, Search } from 'lucide-react';

import { cn } from '@myorg/shared/util-classnames';

import { Button } from '../button/button';
import { Popover, PopoverContent, PopoverTrigger } from '../popover/popover';

export interface SearchableSelectOption {
  /** Stable, unique option value. */
  value: string;
  /** Visible label and searchable text. */
  label: string;
  disabled?: boolean;
}

export interface SearchableSelectProps {
  /** Connects the trigger to an external label. */
  id?: string;
  options: readonly SearchableSelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
}

/** Accessible searchable select backed by the shared Popover and cmdk primitives. */
export function SearchableSelect({
  id,
  options,
  value,
  onValueChange,
  placeholder = 'Select an option',
  searchPlaceholder = 'Search options...',
  emptyMessage = 'No options found.',
  disabled = false,
  className,
}: SearchableSelectProps) {
  const generatedId = React.useId();
  const triggerId = id ?? generatedId;
  const [open, setOpen] = React.useState(false);
  const selectedOption = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={triggerId}
          type="button"
          variant="outline"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between text-left font-normal',
            className,
          )}
        >
          <span
            className={cn(
              'min-w-0 truncate',
              !selectedOption && 'text-muted-foreground',
            )}
          >
            {selectedOption?.label ?? placeholder}
          </span>
          <ChevronsUpDown
            className="ml-2 h-4 w-4 shrink-0 opacity-50"
            aria-hidden="true"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command label={searchPlaceholder} loop>
          <div className="relative border-b">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Command.Input
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
              className="h-10 w-full bg-transparent pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List
            label="Options"
            className="max-h-60 overflow-y-auto p-1"
          >
            <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </Command.Empty>
            {options.map((option) => (
              <Command.Item
                key={option.value}
                value={option.value}
                keywords={[option.label]}
                disabled={option.disabled}
                onSelect={() => {
                  setOpen(false);
                  if (option.value !== value) onValueChange(option.value);
                }}
                className={cn(
                  'flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none',
                  'aria-selected:bg-accent aria-selected:text-accent-foreground',
                  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                )}
              >
                <Check
                  className={cn(
                    'h-4 w-4 shrink-0',
                    option.value === value ? 'opacity-100' : 'opacity-0',
                  )}
                  aria-hidden="true"
                />
                <span className="truncate">{option.label}</span>
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
