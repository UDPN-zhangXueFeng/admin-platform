'use client';

import * as React from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  LayoutGrid,
  List,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
} from '@myorg/shared/ui';

export type TokenSelectorMode = 'tabs' | 'dropdown';
export type TokenSelectorStatus = 'active' | 'pending' | 'inactive';
type TokenSelectorType = TokenSelectorOption['type'] | 'ALL';

export interface TokenSelectorOption {
  id: string;
  name: string;
  symbol?: string;
  network?: string;
  type: 'S' | 'M' | 'TD';
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

const CHIP_LIMIT = 48;
const ALL_NETWORKS = 'ALL';
const ALL_TOKEN_TYPES = 'ALL';
const TOKEN_TYPES: readonly TokenSelectorType[] = [
  ALL_TOKEN_TYPES,
  'S',
  'TD',
  'M',
];
const NETWORK_COLOURS: Record<
  string,
  { background: string; foreground: string }
> = {
  Besu: { background: '#d1fae5', foreground: '#047857' },
  CFLR: { background: '#cffafe', foreground: '#0e7490' },
  SEPOLIA: { background: '#ede9fe', foreground: '#7c3aed' },
  Polygon: { background: '#f3e8ff', foreground: '#9333ea' },
  BNB: { background: '#fef3c7', foreground: '#b45309' },
  TRON: { background: '#fee2e2', foreground: '#dc2626' },
  AVAX: { background: '#fce7f3', foreground: '#db2777' },
};

function getNetworkColours(network: string) {
  return (
    NETWORK_COLOURS[network] ?? { background: '#e2e8f0', foreground: '#475569' }
  );
}

function TokenMark({
  option,
  large = false,
}: {
  option: TokenSelectorOption;
  large?: boolean;
}) {
  const colour =
    option.type === 'M'
      ? '#14b8a6'
      : option.type === 'TD'
        ? '#8b5cf6'
        : '#f59e0b';
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white ${large ? 'h-10 w-10 text-sm' : 'h-5 w-5 text-[9px]'}`}
      style={{ backgroundColor: colour }}
    >
      {option.type}
    </span>
  );
}

function NetworkBadge({ network }: { network: string }) {
  const colours = getNetworkColours(network);
  return (
    <span
      className="inline-flex max-w-24 shrink-0 truncate rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none"
      style={{ backgroundColor: colours.background, color: colours.foreground }}
    >
      {network}
    </span>
  );
}

function StatusIcon({ status }: { status: TokenSelectorStatus }) {
  if (status === 'pending')
    return <Clock className="h-3 w-3 shrink-0 text-amber-500" />;
  if (status === 'inactive')
    return <XCircle className="h-3 w-3 shrink-0 text-red-500" />;
  return <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />;
}

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
        {TOKEN_TYPES.map((type) => {
          const selected = activeType === type;
          const label =
            type === ALL_TOKEN_TYPES
              ? labels.allTokenTypes
              : type === 'S'
                ? labels.stablecoin
                : type === 'TD'
                  ? labels.tokenizedDeposit
                  : labels.tokenizedMmf;
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
      ) : (
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
      )}
    </div>
  );
}
