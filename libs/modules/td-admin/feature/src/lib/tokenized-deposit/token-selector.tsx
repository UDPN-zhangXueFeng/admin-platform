'use client';

import * as React from 'react';
import { LayoutGrid, List, Search, X } from 'lucide-react';
import { getNetworkColours } from './token-selector-badges';
import { TokenDropdownView } from './token-selector-dropdown-view';
import { CHIP_LIMIT, TokenTabsView } from './token-selector-tabs-view';

export type TokenSelectorMode = 'tabs' | 'dropdown';
export type TokenSelectorStatus = 'active' | 'pending' | 'inactive';
type TokenSelectorType = TokenSelectorOption['type'] | 'ALL';

export interface TokenSelectorOption {
  id: string;
  name: string;
  symbol?: string;
  network?: string;
  type: 'S' | 'M' | 'TD' | 'R-CBDC' | 'W-CBDC';
  status: TokenSelectorStatus;
}

export interface TokenSelectorLabels {
  title: string;
  count: (count: number) => string;
  search: string;
  clearSearch: string;
  allTokenTypes: string;
  stablecoin: string;
  tokenizedDeposit: string;
  tokenizedMmf: string;
  retailCbdc: string;
  wholesaleCbdc: string;
  allNetworks: string;
  tabView: string;
  dropdownView: string;
  contexts: string;
  loading: string;
  empty: string;
  noMatch: string;
  expand: (count: number) => string;
  collapse: string;
  select: string;
  active: string;
  pending: string;
  inactive: string;
}

export interface TokenSelectorProps {
  options: readonly TokenSelectorOption[];
  value: string | null;
  mode: TokenSelectorMode;
  labels: TokenSelectorLabels;
  action?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  onValueChange: (id: string) => void;
  onModeChange: (mode: TokenSelectorMode) => void;
}

const ALL_NETWORKS = 'ALL';
const ALL_TOKEN_TYPES = 'ALL';
const TOKEN_TYPES: readonly TokenSelectorType[] = [
  ALL_TOKEN_TYPES,
  'S',
  'TD',
  'M',
  'R-CBDC',
  'W-CBDC',
];

export function TokenSelector({
  options,
  value,
  mode,
  labels,
  action,
  loading = false,
  disabled = false,
  onValueChange,
  onModeChange,
}: TokenSelectorProps) {
  const [search, setSearch] = React.useState('');
  const [activeType, setActiveType] =
    React.useState<TokenSelectorType>(ALL_TOKEN_TYPES);
  const [activeNetwork, setActiveNetwork] = React.useState(ALL_NETWORKS);
  const [showAll, setShowAll] = React.useState(false);
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  const networks = React.useMemo(
    () =>
      Array.from(
        new Set(options.map((option) => option.network).filter(Boolean)),
      ) as string[],
    [options],
  );
  const filteredOptions = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return options.filter((option) => {
      const matchesSearch =
        !query ||
        option.name.toLowerCase().includes(query) ||
        option.symbol?.toLowerCase().includes(query);
      const matchesNetwork =
        activeNetwork === ALL_NETWORKS || option.network === activeNetwork;
      const matchesType =
        activeType === ALL_TOKEN_TYPES || option.type === activeType;
      return matchesSearch && matchesNetwork && matchesType;
    });
  }, [activeNetwork, activeType, options, search]);
  const activeOption = options.find((option) => option.id === value) ?? null;
  const displayedOptions = showAll
    ? filteredOptions
    : filteredOptions.slice(0, CHIP_LIMIT);
  const isUnavailable = disabled || loading || options.length === 0;

  const handleSelect = (option: TokenSelectorOption) => {
    if (isUnavailable || option.id === value) return;
    onValueChange(option.id);
    setDropdownOpen(false);
  };

  if (loading) {
    return (
      <div
        aria-label={labels.loading}
        className="h-36 animate-pulse rounded-xl border bg-muted"
      />
    );
  }

  return (
    <div className="w-full rounded-xl border bg-card p-3 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold uppercase tracking-widest">
            {labels.title}
          </span>
          <span className="h-1 w-1 rounded-full bg-border" />
          <span>{labels.count(options.length)}</span>
        </div>
        <div className="flex items-center gap-2">
          {action}
          <div className="flex items-center rounded-lg border bg-background p-0.5 shadow-sm">
            {(['tabs', 'dropdown'] as const).map((nextMode) => {
              const Icon = nextMode === 'tabs' ? LayoutGrid : List;
              return (
                <button
                  key={nextMode}
                  type="button"
                  className={`flex h-7 w-8 items-center justify-center rounded-md transition-colors ${mode === nextMode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => onModeChange(nextMode)}
                  disabled={disabled}
                  aria-label={
                    nextMode === 'tabs' ? labels.tabView : labels.dropdownView
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5 px-1">
        {TOKEN_TYPES.filter((type) =>
          (type !== 'R-CBDC' && type !== 'W-CBDC') || options.some((option) => option.type === type),
        ).map((type) => {
          const selected = activeType === type;
          const label =
            type === ALL_TOKEN_TYPES
              ? labels.allTokenTypes
              : type === 'S'
                ? labels.stablecoin
                : type === 'TD'
                  ? labels.tokenizedDeposit
                  : type === 'M'
                    ? labels.tokenizedMmf
                    : type === 'R-CBDC'
                      ? labels.retailCbdc
                      : labels.wholesaleCbdc;
          return (
            <button
              key={type}
              type="button"
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'}`}
              onClick={() => {
                setActiveType(type);
                setShowAll(false);
              }}
              aria-pressed={selected}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5 px-1">
        {[ALL_NETWORKS, ...networks].map((network) => {
          const selected = activeNetwork === network;
          const colours =
            network === ALL_NETWORKS
              ? { background: '#e0e7ff', foreground: '#4338ca' }
              : getNetworkColours(network);
          return (
            <button
              key={network}
              type="button"
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${selected ? 'ring-1 ring-current' : 'opacity-60 hover:opacity-100'}`}
              style={{
                backgroundColor: colours.background,
                color: colours.foreground,
              }}
              onClick={() => {
                setActiveNetwork(network);
                setShowAll(false);
              }}
              aria-pressed={selected}
            >
              {network === ALL_NETWORKS ? labels.allNetworks : network}
            </button>
          );
        })}
        <div className="relative ml-auto w-full sm:w-44">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={labels.search}
            className="h-8 w-full rounded-lg border bg-background pl-8 pr-8 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label={labels.clearSearch}
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      </div>

      {mode === 'tabs' ? (
        <TokenTabsView
          options={options}
          displayedOptions={displayedOptions}
          filteredOptions={filteredOptions}
          search={search}
          showAll={showAll}
          value={value}
          disabled={disabled}
          labels={labels}
          handleSelect={handleSelect}
          setShowAll={setShowAll}
        />
      ) : (
        <TokenDropdownView
          dropdownOpen={dropdownOpen}
          setDropdownOpen={setDropdownOpen}
          isUnavailable={isUnavailable}
          activeOption={activeOption}
          filteredOptions={filteredOptions}
          value={value}
          labels={labels}
          handleSelect={handleSelect}
        />
      )}
    </div>
  );
}
