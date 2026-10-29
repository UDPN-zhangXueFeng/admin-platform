/**
 * TokenSelector Tabs 视图：代币筹码列表 + 展开/收起。
 * 源: token-selector.tsx 73, 324-373
 */
'use client';

import * as React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { NetworkBadge, StatusIcon, TokenMark } from './token-selector-badges';
import type {
  TokenSelectorLabels,
  TokenSelectorOption,
} from './token-selector';

export const CHIP_LIMIT = 48;

interface TokenTabsViewProps {
  options: readonly TokenSelectorOption[];
  displayedOptions: TokenSelectorOption[];
  filteredOptions: TokenSelectorOption[];
  search: string;
  showAll: boolean;
  value: string | null;
  disabled: boolean;
  labels: TokenSelectorLabels;
  handleSelect: (option: TokenSelectorOption) => void;
  setShowAll: React.Dispatch<React.SetStateAction<boolean>>;
}

export function TokenTabsView({
  options,
  displayedOptions,
  filteredOptions,
  search,
  showAll,
  value,
  disabled,
  labels,
  handleSelect,
  setShowAll,
}: TokenTabsViewProps): React.JSX.Element {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <div
        className="flex flex-wrap gap-1.5"
        role="tablist"
        aria-label={labels.contexts}
      >
        {displayedOptions.length ? (
          displayedOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={option.id === value}
              disabled={disabled}
              onClick={() => handleSelect(option)}
              className={`inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${option.id === value ? 'border-indigo-300 bg-indigo-50 text-indigo-700 shadow-sm ring-2 ring-indigo-100' : 'border-transparent bg-background text-slate-700 hover:border-slate-200 hover:bg-slate-50'}`}
            >
              <TokenMark option={option} />
              <span className="max-w-36 truncate">{option.name}</span>
              {option.network ? (
                <NetworkBadge network={option.network} />
              ) : null}
              <StatusIcon status={option.status} />
            </button>
          ))
        ) : (
          <div className="w-full py-8 text-center text-sm text-muted-foreground">
            {options.length ? labels.noMatch : labels.empty}
          </div>
        )}
      </div>
      {filteredOptions.length > CHIP_LIMIT && !search ? (
        <div className="mt-3 flex justify-center border-t pt-2.5">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary"
            onClick={() => setShowAll((current) => !current)}
          >
            {showAll ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            {showAll
              ? labels.collapse
              : labels.expand(filteredOptions.length - CHIP_LIMIT)}
          </button>
        </div>
      ) : null}
    </div>
  );
}
