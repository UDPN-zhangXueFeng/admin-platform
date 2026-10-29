/**
 * TokenSelector Dropdown 视图：下拉选择 + 选中代币详情卡。
 * 源: token-selector.tsx 375-447
 */
'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
} from '@myorg/shared/ui';
import { NetworkBadge, StatusIcon, TokenMark } from './token-selector-badges';
import type {
  TokenSelectorLabels,
  TokenSelectorOption,
} from './token-selector';

interface TokenDropdownViewProps {
  dropdownOpen: boolean;
  setDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isUnavailable: boolean;
  activeOption: TokenSelectorOption | null;
  filteredOptions: TokenSelectorOption[];
  value: string | null;
  labels: TokenSelectorLabels;
  handleSelect: (option: TokenSelectorOption) => void;
}

export function TokenDropdownView({
  dropdownOpen,
  setDropdownOpen,
  isUnavailable,
  activeOption,
  filteredOptions,
  value,
  labels,
  handleSelect,
}: TokenDropdownViewProps): React.JSX.Element {
  return (
    <div className="grid gap-3 md:grid-cols-[14rem_minmax(0,1fr)]">
      <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={isUnavailable}
            className="flex h-11 w-full items-center gap-2 rounded-xl border bg-background px-3 text-sm font-medium shadow-sm"
            aria-label={labels.select}
          >
            {activeOption ? (
              <>
                <TokenMark option={activeOption} />
                <span className="min-w-0 flex-1 truncate text-left">
                  {activeOption.name}
                </span>
                {activeOption.network ? (
                  <NetworkBadge network={activeOption.network} />
                ) : null}
              </>
            ) : (
              <span className="flex-1 text-left text-muted-foreground">
                {labels.empty}
              </span>
            )}
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-0">
          <ScrollArea className="h-72">
            <div className="p-1">
              {filteredOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm ${option.id === value ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                >
                  <TokenMark option={option} />
                  <span className="min-w-0 flex-1 truncate text-left font-medium">
                    {option.name}
                  </span>
                  {option.network ? (
                    <NetworkBadge network={option.network} />
                  ) : null}
                  <StatusIcon status={option.status} />
                </button>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
      {activeOption ? (
        <div className="rounded-xl border bg-background p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <TokenMark option={activeOption} large />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {activeOption.name}
              </p>
              <div className="mt-1 flex items-center gap-2">
                {activeOption.network ? (
                  <NetworkBadge network={activeOption.network} />
                ) : null}
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                  <StatusIcon status={activeOption.status} />
                  {labels[activeOption.status]}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
