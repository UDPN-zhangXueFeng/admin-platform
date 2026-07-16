'use client';

import * as React from 'react';
import { RefreshCw, Wallet, Coins, Flame, ArrowLeftRight } from 'lucide-react';
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
  | 'surplusCount'
  | 'circulationTotal'
  | 'issueTotal'
  | 'destructionTotal'
  | 'numOfWallets';

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
    icon: Wallet,
    field: 'surplusCount',
    showUnit: true,
  },
  {
    id: 'circulation',
    labelKey: 'circulation',
    icon: Coins,
    field: 'circulationTotal',
    showUnit: true,
  },
  {
    id: 'minted',
    labelKey: 'minted',
    icon: ArrowLeftRight,
    field: 'issueTotal',
    showUnit: true,
  },
  {
    id: 'melted',
    labelKey: 'melted',
    icon: Flame,
    field: 'destructionTotal',
    showUnit: true,
  },
  {
    id: 'walletCount',
    labelKey: 'walletCount',
    icon: Wallet,
    field: 'numOfWallets',
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
  const [refreshPulse, setRefreshPulse] = React.useState({
    overview: 0,
    wallet: 0,
    transaction: 0,
  });

  // --- Queries ---
  const stablecoinOptionsQuery = useStablecoinOptionsQuery();
  const overviewQuery = useStableCoinOverviewQuery();

  // Derived: the full list of stablecoin options from the API
  const options = React.useMemo(
    () => stablecoinOptionsQuery.data ?? [],
    [stablecoinOptionsQuery.data],
  );

  const displayOptions = options;

  // Active token symbol (kept as string for API compatibility)
  const activeOption =
    displayOptions.find(
      (option) =>
        String(option.stablecoinId ?? option.code ?? option.symbol) ===
        activeTokenId,
    ) ?? displayOptions[0];
  const activeToken = activeOption?.symbol?.toLowerCase() ?? '';
  const tokenSymbol = activeToken.toUpperCase();

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

  const walletQuery = useWalletStatisticsQuery(activeToken, walletRange);
  const transactionQuery = useTransactionStatisticsQuery(
    activeToken,
    transactionRange,
  );

  // Wallet statistics → recharts data shape
  const walletChartData = React.useMemo(() => {
    const res = walletQuery.data;
    if (!res?.dateList?.length) return [];
    return res.dateList.map((name: string, i: number) => ({
      name,
      total: res.statisticsCount.walletNum[i] ?? 0,
      new: res.statisticsCount.newWalletNum[i] ?? 0,
    }));
  }, [walletQuery.data]);

  // Transaction statistics → recharts data shape
  const transactionChartData = React.useMemo(() => {
    const res = transactionQuery.data;
    if (!res?.dateList?.length) return [];
    return res.dateList.map((name: string, i: number) => ({
      name,
      purchase: res.statisticsCount.purchaseTotal[i] ?? 0,
      transfer: res.statisticsCount.transferTotal[i] ?? 0,
      withdrawal: res.statisticsCount.withdrawalTotal[i] ?? 0,
    }));
  }, [transactionQuery.data]);

  // --- Actions ---
  const triggerRefresh = React.useCallback(
    (key: 'overview' | 'wallet' | 'transaction') => {
      setRefreshPulse((p) => ({ ...p, [key]: p[key] + 1 }));
      if (key === 'overview') void overviewQuery.refetch();
      else if (key === 'wallet') void walletQuery.refetch();
      else void transactionQuery.refetch();
    },
    [overviewQuery, walletQuery, transactionQuery],
  );

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            {t('title')}
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <div className="rounded-md border bg-card px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {t('sourceLabel')}:
          </span>{' '}
          {t('sourceDescription')}
        </div>
      </div>

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

        {overviewQuery.isLoading || overviewQuery.data ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {overviewQuery.isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))
              : OVERVIEW_METRICS.map((metric) => {
                  const Icon = metric.icon;
                  const value = overviewQuery.data?.[metric.field] ?? 0;

                  return (
                    <div
                      key={metric.id}
                      className="rounded-lg border bg-background p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            {metric.labelKey === 'circulation'
                              ? t(metric.labelKey, { symbol: tokenSymbol })
                              : t(metric.labelKey)}
                          </p>
                          <p className="text-2xl font-semibold tracking-tight">
                            {formatNumber(value)}
                            {metric.showUnit ? (
                              <span className="ml-2 text-sm font-medium text-muted-foreground">
                                {tokenSymbol}
                              </span>
                            ) : null}
                          </p>
                        </div>
                        <div className="rounded-md bg-primary/10 p-2 text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                      </div>
                    </div>
                  );
                })}
          </div>
        ) : null}
      </section>

      {/* ---- Charts ---- */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Wallet Statistics */}
        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <PanelHeader
            title={t('walletStatsTitle')}
            range={walletRange}
            onRangeChange={setWalletRange}
            onRefresh={() => triggerRefresh('wallet')}
            t={t}
            refreshing={refreshPulse.wallet % 2 === 1 || walletQuery.isFetching}
          />
          <div className="mt-6 h-[320px]">
            {walletQuery.isLoading ? (
              <SkeletonChart />
            ) : walletChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={walletChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    stroke="#94a3b8"
                  />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
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
                    radius={[4, 4, 0, 0]}
                    name={t('walletTotal')}
                  />
                  <Bar
                    dataKey="new"
                    fill={CHART_COLORS.walletNew}
                    radius={[4, 4, 0, 0]}
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
        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <PanelHeader
            title={t('transactionStatsTitle', { symbol: tokenSymbol })}
            range={transactionRange}
            onRangeChange={setTransactionRange}
            onRefresh={() => triggerRefresh('transaction')}
            t={t}
            refreshing={
              refreshPulse.transaction % 2 === 1 || transactionQuery.isFetching
            }
          />
          <div className="mt-6 h-[320px]">
            {transactionQuery.isLoading ? (
              <SkeletonChart />
            ) : transactionChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={transactionChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    stroke="#94a3b8"
                  />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
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
                    dot={{ r: 3 }}
                    name={t('purchaseTotal')}
                  />
                  <Line
                    type="monotone"
                    dataKey="transfer"
                    stroke={CHART_COLORS.transfer}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name={t('transferTotal')}
                  />
                  <Line
                    type="monotone"
                    dataKey="withdrawal"
                    stroke={CHART_COLORS.withdrawal}
                    strokeWidth={2}
                    dot={{ r: 3 }}
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
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          aria-label={t('refresh')}
        >
          <RefreshCw className={refreshing ? 'animate-spin' : ''} />
        </Button>
      </div>

      <div className="w-full lg:w-[180px]">
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
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-9 w-9 animate-pulse rounded-md bg-muted" />
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
