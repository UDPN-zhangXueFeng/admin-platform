'use client';

import * as React from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CircleDollarSign,
  RefreshCw,
  Vault,
  Wallet,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import {
  useStablecoinOptionsQuery,
  useStableCoinOverviewQuery,
  useWalletStatisticsQuery,
  useTransactionStatisticsQuery,
  type TimeRangeKey,
} from '@myorg/modules/dashboard/data-access';
import {
  StablecoinTabs,
  type StablecoinTabsDisplayMode,
} from './components/StablecoinTabs';

// ---------------------------------------------------------------------------
// Static config – maps UI metric slots to API fields (no mock data)
// ---------------------------------------------------------------------------

type MetricId =
  | 'repositoryBalance'
  | 'circulation'
  | 'minted'
  | 'melted'
  | 'walletCount';

type OverviewField =
  | 'repositoryBalance'
  | 'circulation'
  | 'totalMint'
  | 'totalMelt'
  | 'walletNumber';

const OVERVIEW_METRICS: ReadonlyArray<{
  id: MetricId;
  labelKey: MetricId;
  icon: React.ComponentType<{ className?: string }>;
  field: OverviewField;
  showUnit?: boolean;
}> = [
  {
    id: 'repositoryBalance',
    labelKey: 'repositoryBalance',
    icon: Vault,
    field: 'repositoryBalance',
    showUnit: true,
  },
  {
    id: 'circulation',
    labelKey: 'circulation',
    icon: CircleDollarSign,
    field: 'circulation',
    showUnit: true,
  },
  {
    id: 'minted',
    labelKey: 'minted',
    icon: ArrowDownToLine,
    field: 'totalMint',
    showUnit: true,
  },
  {
    id: 'melted',
    labelKey: 'melted',
    icon: ArrowUpFromLine,
    field: 'totalMelt',
    showUnit: true,
  },
  {
    id: 'walletCount',
    labelKey: 'walletCount',
    icon: Wallet,
    field: 'walletNumber',
  },
] as const;

const RANGE_OPTIONS: ReadonlyArray<{
  key: TimeRangeKey;
  translationKey: 'last7Days' | 'last14Days' | 'last30Days';
}> = [
  { key: '7d', translationKey: 'last7Days' },
  { key: '14d', translationKey: 'last14Days' },
  { key: '30d', translationKey: 'last30Days' },
] as const;

/** Chart palette – matches the Tailwind color classes from the previous CSS implementation */
const CHART_COLORS = {
  walletTotal: '#3b82f6',
  walletNew: 'rgba(59,130,246,0.35)',
  purchase: '#0ea5e9',
  transfer: '#6366f1',
  withdrawal: '#f59e0b',
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatStatisticsDay(value: number | undefined): string {
  if (!value) return '—';
  const timestamp = value < 1_000_000_000_000 ? value * 1000 : value;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const t = useTranslations('modules.dashboard');

  // --- Token selection ---
  const [activeTokenId, setActiveTokenId] = React.useState<string | null>(null);
  const [tokenSelectorMode, setTokenSelectorMode] =
    React.useState<StablecoinTabsDisplayMode>('tabs');

  const [walletRange, setWalletRange] = React.useState<TimeRangeKey>('7d');
  const [transactionRange, setTransactionRange] =
    React.useState<TimeRangeKey>('7d');

  // --- Queries ---
  const stablecoinOptionsQuery = useStablecoinOptionsQuery();

  // Derived: the full list of stablecoin options from the API
  const options = React.useMemo(
    () => stablecoinOptionsQuery.data ?? [],
    [stablecoinOptionsQuery.data],
  );

  const displayOptions = options;

  // API requires stablecoinCode. symbol is display-only and must not be used as the request key.
  const activeOption =
    displayOptions.find(
      (option) =>
        String(option.stablecoinId ?? option.code ?? option.symbol) ===
        activeTokenId,
    ) ?? displayOptions[0];
  const stablecoinCode = activeOption?.code ?? '';
  const tokenSymbol = activeOption?.symbol ?? '';

  const overviewQuery = useStableCoinOverviewQuery(stablecoinCode);

  // Select the first available token only when the current stable id no longer exists.
  React.useEffect(() => {
    if (displayOptions.length === 0) {
      setActiveTokenId(null);
      return;
    }

    const hasActiveToken = displayOptions.some(
      (option) =>
        String(option.stablecoinId ?? option.code ?? option.symbol) ===
        activeTokenId,
    );

    if (!hasActiveToken) {
      const firstOption = displayOptions[0];
      setActiveTokenId(
        String(
          firstOption.stablecoinId ?? firstOption.code ?? firstOption.symbol,
        ),
      );
    }
  }, [activeTokenId, displayOptions]);

  const walletQuery = useWalletStatisticsQuery(stablecoinCode, walletRange);
  const transactionQuery = useTransactionStatisticsQuery(
    stablecoinCode,
    transactionRange,
  );

  // Wallet statistics → recharts data shape
  const walletChartData = React.useMemo(() => {
    return (walletQuery.data ?? []).map((item) => ({
      name: formatStatisticsDay(item.statisticsDay),
      total: item.walletNumber ?? 0,
      new: item.walletNewNumber ?? 0,
    }));
  }, [walletQuery.data]);

  // Transaction statistics → recharts data shape
  const transactionChartData = React.useMemo(() => {
    return (transactionQuery.data ?? []).map((item) => ({
      name: formatStatisticsDay(item.statisticsDay),
      purchase: item.topUpTotal ?? 0,
      transfer: item.transferTotal ?? 0,
      withdrawal: item.withdrawalTotal ?? 0,
    }));
  }, [transactionQuery.data]);

  const triggerRefresh = React.useCallback(
    (key: 'overview' | 'wallet' | 'transaction') => {
      if (key === 'overview') void overviewQuery.refetch();
      else if (key === 'wallet') void walletQuery.refetch();
      else void transactionQuery.refetch();
    },
    [overviewQuery, walletQuery, transactionQuery],
  );

  return (
    <div className="space-y-7">
      {/* ---- Token Selector + Overview Cards ---- */}
      <section className="space-y-6">
        <div className="min-w-0">
          <StablecoinTabs
            options={displayOptions}
            value={activeTokenId}
            mode={tokenSelectorMode}
            loading={stablecoinOptionsQuery.isLoading}
            disabled={stablecoinOptionsQuery.isError}
            onValueChange={setActiveTokenId}
            onModeChange={setTokenSelectorMode}
          />
        </div>

        <section
          aria-label={t('overviewTitle', { symbol: tokenSymbol || '—' })}
        >
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium text-muted-foreground">
              {t('overviewTitle', { symbol: tokenSymbol || '—' })}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
              onClick={() => triggerRefresh('overview')}
              aria-label={t('refresh')}
              disabled={overviewQuery.isFetching}
            >
              <RefreshCw
                className={`size-3.5 ${overviewQuery.isFetching ? 'animate-spin' : ''}`}
              />
              {t('refresh')}
            </Button>
          </div>

          {overviewQuery.isLoading || overviewQuery.data ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {overviewQuery.isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))
                : OVERVIEW_METRICS.map((metric) => {
                    const Icon = metric.icon;
                    const value = overviewQuery.data?.[metric.field] ?? 0;

                    return (
                      <MetricCard
                        key={metric.id}
                        icon={<Icon className="size-4" />}
                        label={
                          metric.labelKey === 'circulation'
                            ? t(metric.labelKey, { symbol: tokenSymbol })
                            : t(metric.labelKey)
                        }
                        compactValue={formatCompactNumber(value)}
                        fullValue={formatNumber(value)}
                        unit={metric.showUnit ? tokenSymbol : undefined}
                        hideFullValue={metric.id === 'walletCount'}
                      />
                    );
                  })}
            </div>
          ) : null}
        </section>
      </section>

      {/* ---- Charts ---- */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Wallet Statistics */}
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <PanelHeader
            title={t('walletStatsTitle')}
            range={walletRange}
            onRangeChange={setWalletRange}
            onRefresh={() => triggerRefresh('wallet')}
            t={t}
            refreshing={walletQuery.isFetching}
          />
          <div className="h-[320px] px-5 pb-5 pt-1 sm:px-6">
            {walletQuery.isLoading ? (
              <SkeletonChart />
            ) : walletChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={walletChartData}>
                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="3 3"
                    stroke="#e5e7eb"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    stroke="#94a3b8"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="#94a3b8"
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: 12,
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="total"
                    fill={CHART_COLORS.walletTotal}
                    radius={[5, 5, 0, 0]}
                    maxBarSize={30}
                    name={t('walletTotal')}
                  />
                  <Bar
                    dataKey="new"
                    fill={CHART_COLORS.walletNew}
                    radius={[5, 5, 0, 0]}
                    maxBarSize={30}
                    name={t('walletNew')}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label={t('chartEmpty')} />
            )}
          </div>
        </section>

        {/* Transaction Statistics */}
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <PanelHeader
            title={t('transactionStatsTitle', { symbol: tokenSymbol })}
            range={transactionRange}
            onRangeChange={setTransactionRange}
            onRefresh={() => triggerRefresh('transaction')}
            t={t}
            refreshing={transactionQuery.isFetching}
          />
          <div className="h-[320px] px-5 pb-5 pt-1 sm:px-6">
            {transactionQuery.isLoading ? (
              <SkeletonChart />
            ) : transactionChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={transactionChartData}>
                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="3 3"
                    stroke="#e5e7eb"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    stroke="#94a3b8"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="#94a3b8"
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: 12,
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="purchase"
                    stroke={CHART_COLORS.purchase}
                    strokeWidth={2}
                    dot={false}
                    name={t('purchaseTotal')}
                  />
                  <Line
                    type="monotone"
                    dataKey="transfer"
                    stroke={CHART_COLORS.transfer}
                    strokeWidth={2}
                    dot={false}
                    name={t('transferTotal')}
                  />
                  <Line
                    type="monotone"
                    dataKey="withdrawal"
                    stroke={CHART_COLORS.withdrawal}
                    strokeWidth={2}
                    dot={false}
                    name={t('withdrawalTotal')}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label={t('chartEmpty')} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PanelHeader({
  title,
  range,
  onRangeChange,
  onRefresh,
  t,
  refreshing,
}: {
  title: string;
  range: TimeRangeKey;
  onRangeChange: (value: TimeRangeKey) => void;
  onRefresh: () => void;
  t: ReturnType<typeof useTranslations<'modules.dashboard'>>;
  refreshing: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/70 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          aria-label={t('refresh')}
          disabled={refreshing}
        >
          <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="w-full sm:w-[160px]">
        <Select
          value={range}
          onValueChange={(value) => onRangeChange(value as TimeRangeKey)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((option) => (
              <SelectItem key={option.key} value={option.key}>
                {t(option.translationKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/** Loading placeholder for a single overview card */
function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <div className="size-8 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        </div>
        <div className="space-y-2">
          <div className="h-7 w-24 animate-pulse rounded bg-muted" />
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  compactValue,
  fullValue,
  unit,
  hideFullValue = false,
}: {
  icon: React.ReactNode;
  label: string;
  compactValue: string;
  fullValue: string;
  unit?: string;
  hideFullValue?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <p className="min-w-0 text-sm leading-snug text-muted-foreground">
          {label}
        </p>
      </div>
      <div className="mt-4 min-w-0">
        <p
          className="truncate font-mono text-xl font-semibold tracking-tight text-foreground"
          title={fullValue}
        >
          {compactValue}
          {unit ? (
            <span className="ml-1.5 text-xs font-medium text-muted-foreground">
              {unit}
            </span>
          ) : null}
        </p>
        {!hideFullValue ? (
          <p
            className="mt-1 truncate font-mono text-sm text-muted-foreground"
            title={fullValue}
          >
            {fullValue}
            {unit ? <span className="ml-1">{unit}</span> : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Deterministic skeleton bars for chart loading state */
const SKELETON_BAR_HEIGHTS = [
  45, 65, 35, 80, 55, 70, 40, 60, 50, 75, 30, 85, 42, 68,
] as const;

function SkeletonChart() {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center gap-4">
        <div className="h-3 w-16 animate-pulse rounded bg-muted" />
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex flex-1 items-end gap-1.5">
        {SKELETON_BAR_HEIGHTS.slice(0, 7).map((h, i) => (
          <div
            key={i}
            className="flex-1 animate-pulse rounded-t bg-muted"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
