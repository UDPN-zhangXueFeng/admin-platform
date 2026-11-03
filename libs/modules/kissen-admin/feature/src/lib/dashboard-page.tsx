'use client';

import * as React from 'react';
import {
  ArrowLeftRight,
  Building2,
  Coins,
  Droplets,
  RefreshCw,
} from 'lucide-react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Alert, AlertTitle, Button, Card, Skeleton } from '@myorg/shared/ui';
import { cn } from '@myorg/shared/util-classnames';
import { useRouter } from '@myorg/shared/util-i18n';
import {
  KISSEN_PROJECT_ID,
  useDashboardPairDistQuery,
  useDashboardSummaryQuery,
  useDashboardTrendQuery,
  type DashboardPairBar,
  type ExceptionGroupKey,
} from '@myorg/modules/kissen-admin/data-access';
import { ProtoStatusBadge } from './proto-ui';
import { formatUtc8 } from './proto-format';

const EXCEPTION_GROUPS: { key: ExceptionGroupKey; label: string }[] = [
  { key: 'PENDING', label: 'Requires manual handling' },
  { key: 'REVERSED', label: 'Reversed (including reversing)' },
  { key: 'FAILED', label: 'Failed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

/** Shared window for the trend chart and the pair distribution. */
const WINDOW_OPTIONS = [7, 30];

/**
 * 固定告警线：覆盖率低于 20% 才告急并通知 LP（2026-11-03 裁决）。
 * 与后端 `PoolAlertMath.ALERT_RATIO`、资金池页 `COVERAGE_ALERT_PERCENT` 必须一致。
 */
const COVERAGE_ALERT_PERCENT = 20;

/**
 * Pair display name. The API labels pairs `sourceSymbol→targetSymbol`, but the
 * arrow falls back to another font inside monospace runs; the slash form is the
 * convention for a pair anyway.
 */
function pairLabel(row: DashboardPairBar): string {
  if (row.pairId === 0) return 'Unmatched';
  return row.label.includes('→') ? row.label.replace('→', '/') : row.label;
}

function WindowSelector({
  value,
  options,
  onChange,
}: {
  value: number;
  options: number[];
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex gap-1" role="group" aria-label="Time window">
      {options.map((days) => (
        <Button
          key={days}
          size="sm"
          variant={value === days ? 'default' : 'outline'}
          aria-pressed={value === days}
          onClick={() => onChange(days)}
        >
          Last {days} days
        </Button>
      ))}
    </div>
  );
}

function PanelCard({
  title,
  subtitle,
  action,
  loading,
  error,
  empty,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  loading?: boolean;
  error?: boolean;
  empty?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn('flex min-w-0 flex-col p-4 min-[1600px]:p-6', className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : error ? (
        <Alert variant="destructive">
          <AlertTitle>Failed to load. Refresh to retry.</AlertTitle>
        </Alert>
      ) : empty ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        children
      )}
    </Card>
  );
}

/** 后端金额串按 token 小数位定长（如 10,000.00000000），展示前裁掉尾随零。 */
function trimAmount(value: string | null | undefined): string {
  if (!value) return '—';
  return value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

/** Exception markers ride on the volume series: one dot per day that had any. */
function renderExceptionDot(raw: unknown): React.ReactElement {
  const props = raw as {
    cx?: number;
    cy?: number;
    payload?: { exception?: number };
  };
  if (!props.payload?.exception || props.cx == null || props.cy == null) {
    return <g />;
  }
  return (
    <circle
      cx={props.cx}
      cy={props.cy}
      r={3}
      fill="hsl(var(--destructive))"
      stroke="hsl(var(--card))"
      strokeWidth={2}
    />
  );
}

export function DashboardPage() {
  const router = useRouter();
  const [days, setDays] = React.useState(7);
  const summaryQ = useDashboardSummaryQuery(KISSEN_PROJECT_ID);
  const pairQ = useDashboardPairDistQuery(KISSEN_PROJECT_ID, days);
  const trendQ = useDashboardTrendQuery(KISSEN_PROJECT_ID, days);
  const summary = summaryQ.data;
  const refreshing =
    summaryQ.isFetching || pairQ.isFetching || trendQ.isFetching;
  const refresh = () => {
    void Promise.all([summaryQ.refetch(), pairQ.refetch(), trendQ.refetch()]);
  };
  const updatedAt = Math.max(
    summaryQ.dataUpdatedAt,
    pairQ.dataUpdatedAt,
    trendQ.dataUpdatedAt,
  );

  const pairs = React.useMemo(
    () => pairQ.data ?? [],
    [pairQ.data, pairQ.dataUpdatedAt],
  );

  // UTC+8 calendar dates match the aggregation API even outside the operating timezone.
  const trendData = React.useMemo(() => {
    const today = Math.floor((Date.now() + 8 * 3600000) / 86400000) * 86400000;
    const byDay = new Map((trendQ.data ?? []).map((row) => [row.day, row]));
    return Array.from({ length: days }, (_, i) => {
      const day = new Date(today - (days - i - 1) * 86400000)
        .toISOString()
        .slice(0, 10);
      return {
        day,
        total: byDay.get(day)?.total ?? 0,
        exception: byDay.get(day)?.exception ?? 0,
        completed: byDay.get(day)?.completed ?? 0,
      };
    });
  }, [trendQ.data, days, trendQ.dataUpdatedAt]);

  const trendTotals = React.useMemo(
    () =>
      trendData.reduce(
        (acc, row) => ({
          total: acc.total + row.total,
          exception: acc.exception + row.exception,
          completed: acc.completed + row.completed,
        }),
        { total: 0, exception: 0, completed: 0 },
      ),
    [trendData],
  );

  // 窗口成功率：成功终态 ÷ 窗口内全部交易（含在途，窗口越长越贴近真实水平）
  const successRate = trendTotals.total
    ? (trendTotals.completed / trendTotals.total) * 100
    : undefined;
  // 后端未下发 completed（旧版本）时不显示成功率，避免恒显 0.0%。
  const hasCompletedData = React.useMemo(
    () => (trendQ.data ?? []).some((row) => row.completed !== undefined),
    [trendQ.data, trendQ.dataUpdatedAt],
  );

  const pairColumns = React.useMemo(() => {
    const paired = pairs.filter((row) => row.pairId !== 0);
    const unmatched = pairs.find((row) => row.pairId === 0);
    const columns = paired.slice(0, 5).map((row) => ({
      key: String(row.pairId),
      label: pairLabel(row),
      count: row.txCount,
      muted: false,
      note: undefined as string | undefined,
    }));
    const rest = paired.slice(5);
    if (rest.length) {
      columns.push({
        key: 'other',
        label: `Other (${rest.length})`,
        count: rest.reduce((sum, row) => sum + row.txCount, 0),
        muted: true,
        note: undefined,
      });
    }
    if (unmatched) {
      columns.push({
        key: 'unmatched',
        label: 'Unmatched',
        count: unmatched.txCount,
        muted: true,
        note: 'not a pair',
      });
    }
    const total = columns.reduce((sum, col) => sum + col.count, 0);
    const max = Math.max(1, ...columns.map((col) => col.count));
    return { columns, total, max };
  }, [pairs]);

  const unmatchedCount = pairs.find((row) => row.pairId === 0)?.txCount ?? 0;
  const criticalPools = summary?.criticalPoolTotal ?? 0;
  const exceptionsToday = summary?.exceptions.today ?? 0;
  const pendingApprovals = summary?.stats.pendingApprovals ?? 0;
  /** 异常分组跟随全局窗口：7 天看 week，30 天看 month（接口只有这两个环形窗口）。 */
  const exceptionKey = days === 30 ? 'month' : 'week';

  const attention = [
    unmatchedCount
      ? {
          key: 'unmatched',
          label: 'Unmatched transfers',
          note: `No LP could cover · last ${days} days`,
          count: unmatchedCount,
          bar: 'bg-destructive',
          to: '/transfer/tx',
        }
      : null,
    exceptionsToday
      ? {
          key: 'exception',
          label: 'Exceptions to handle',
          note: 'Opened today',
          count: exceptionsToday,
          bar: 'bg-warning',
          to: '/transfer/tx?status=70',
        }
      : null,
    pendingApprovals
      ? {
          key: 'approvals',
          label: 'Awaiting your approval',
          note: 'Onboardings and pair changes',
          count: pendingApprovals,
          bar: 'bg-info',
          to: '/approval',
        }
      : null,
    criticalPools
      ? {
          key: 'pools',
          label: 'Pools below threshold',
          note:
            summary?.lowPools
              .slice(0, 2)
              .map((pool) => `${pool.lpName} ${pool.tokenSymbol}`)
              .join(' · ') || 'Liquidity watch',
          count: criticalPools,
          bar: 'bg-warning',
          to: '/liquidity/pool',
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  const scale = [
    {
      label: 'Banks',
      caption: 'onboarded',
      value: summary?.stats.banks,
      icon: Building2,
      to: '/onboard/bank',
    },
    {
      label: 'Liquidity Providers',
      caption: 'onboarded',
      value: summary?.stats.lps,
      icon: Droplets,
      to: '/onboard/lp',
    },
    {
      label: 'Tokens',
      caption: 'active',
      value: summary?.stats.tokens,
      icon: Coins,
      to: '/onboard/token',
    },
    {
      label: 'Token Pairs',
      caption: 'enabled',
      value: summary?.stats.pairs,
      icon: ArrowLeftRight,
      to: '/fx-rate/pair',
    },
  ];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="t-page-title">Dashboard</h1>
          <p className="text-xs text-muted-foreground">
            Network operations · UTC+8
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <WindowSelector
            value={days}
            options={WINDOW_OPTIONS}
            onChange={setDays}
          />
          <span className="text-xs text-muted-foreground">
            Updated {updatedAt ? formatUtc8(updatedAt) : '—'}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={refreshing}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </header>

      <section
        aria-label="Network scale"
        className="grid grid-cols-1 divide-y divide-border overflow-hidden rounded-xl border border-border/50 bg-card shadow-float sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x"
      >
        {scale.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => router.push(item.to)}
              className="flex min-w-0 flex-col gap-1.5 px-4 py-3.5 text-left motion-safe:transition-colors hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className="flex min-w-0 items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Icon className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
                <span className="ml-auto hidden shrink-0 text-[11px] font-normal normal-case tracking-normal sm:inline">
                  {item.caption}
                </span>
              </span>
              <span className="text-2xl font-semibold tabular-nums">
                {summaryQ.isLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : summaryQ.isError ? (
                  '—'
                ) : (
                  (item.value ?? 0).toLocaleString('en-US')
                )}
              </span>
            </button>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PanelCard
          title="Transaction volume"
          subtitle="Settled and in-flight transfers per day · UTC+8"
          action={
            <span className="text-xs text-muted-foreground">
              Last {days} days
            </span>
          }
          loading={trendQ.isLoading}
          error={trendQ.isError}
          className="min-h-[420px] lg:col-span-2"
        >
          <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-border pb-3 text-xs">
            <span className="text-muted-foreground">
              Transfers
              <span className="ml-2 font-mono text-sm font-semibold tabular-nums text-foreground">
                {trendTotals.total.toLocaleString('en-US')}
              </span>
            </span>
            {hasCompletedData ? (
              <span className="text-muted-foreground">
                Settled
                <span className="ml-2 font-mono text-sm font-semibold tabular-nums text-foreground">
                  {successRate == null ? '—' : `${successRate.toFixed(1)}%`}
                </span>
              </span>
            ) : null}
            <span className="text-muted-foreground">
              Exceptions
              <span className="ml-2 font-mono text-sm font-semibold tabular-nums text-destructive">
                {trendTotals.exception}
              </span>
            </span>
            <span className="ml-auto text-muted-foreground">
              Today is in progress
            </span>
          </div>
          <div
            className="h-64 flex-1"
            role="img"
            aria-label="Daily transaction volume with exception markers"
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData}>
                <CartesianGrid
                  stroke="hsl(var(--border))"
                  vertical={false}
                  strokeDasharray="0"
                />
                <XAxis
                  dataKey="day"
                  tickFormatter={(value) => String(value).slice(5)}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  allowDecimals={false}
                  width={32}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    color: 'hsl(var(--foreground))',
                    fontSize: 12,
                  }}
                  labelFormatter={(value) => `Date ${value}`}
                  formatter={(value) => [String(value), 'Transfers']}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="total"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="hsl(var(--primary))"
                  fillOpacity={0.14}
                  dot={renderExceptionDot}
                  activeDot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="h-0.5 w-3.5 rounded bg-primary" />
              Transfers
            </span>
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-destructive" />
              Exceptions
            </span>
          </div>
        </PanelCard>

        <div className="flex min-w-0 flex-col gap-4">
          <Card className="flex min-w-0 flex-col overflow-hidden p-0">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Needs attention</h2>
            </div>
            {summaryQ.isLoading ? (
              <Skeleton className="m-4 h-32" />
            ) : summaryQ.isError ? (
              <Alert variant="destructive" className="m-4">
                <AlertTitle>Failed to load. Refresh to retry.</AlertTitle>
              </Alert>
            ) : attention.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nothing needs attention right now.
              </p>
            ) : (
              <div className="flex flex-1 flex-col">
                {attention.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => router.push(item.to)}
                    className="flex flex-1 items-center gap-3 border-b border-border px-4 py-3.5 text-left last:border-b-0 motion-safe:transition-colors hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span
                      className={cn('w-1 self-stretch rounded-full', item.bar)}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {item.label}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.note}
                      </span>
                    </span>
                    <span className="font-mono text-lg font-semibold tabular-nums">
                      {item.count.toLocaleString('en-US')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <PanelCard
            title="Exceptions by category"
            subtitle={`Today · last ${days} days`}
            action={
              <Button
                variant="link"
                size="sm"
                onClick={() => router.push('/transfer/tx?status=70')}
              >
                View details
              </Button>
            }
            loading={summaryQ.isLoading}
            error={summaryQ.isError}
            className="flex-1"
          >
            <div className="divide-y divide-border">
              {EXCEPTION_GROUPS.map((group) => {
                const row = summary?.exceptions.groups.find(
                  (item) => item.key === group.key,
                );
                return (
                  <div
                    key={group.key}
                    className="flex items-baseline justify-between gap-2 py-2.5 text-sm first:pt-0 last:pb-0"
                  >
                    <span className="min-w-0 truncate">{group.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                        {row?.today ?? 0}
                      </span>{' '}
                      today ·{' '}
                      <span className="font-mono font-medium tabular-nums text-foreground/70">
                        {row?.[exceptionKey] ?? 0}
                      </span>{' '}
                      in {days}d
                    </span>
                  </div>
                );
              })}
            </div>
          </PanelCard>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.16fr]">
        <PanelCard
          title="Volume by pair"
          subtitle={`Last ${days} days · ${pairColumns.total.toLocaleString('en-US')} transfers`}
          loading={pairQ.isLoading}
          error={pairQ.isError}
          empty={
            pairColumns.columns.length ? undefined : 'No transfers in this window.'
          }
        >
          {/* 列数少时不把柱子拉满整卡：按数量收窄绘图区并居中。 */}
          <div className="flex flex-1 flex-col justify-center">
            <div
              className="mx-auto w-full"
              style={{
                maxWidth: `${Math.min(760, pairColumns.columns.length * 150)}px`,
              }}
            >
              {/* 固定高度：柱子按百分比取高，父级必须是确定高度，min-h 不够。 */}
              <div className="flex h-[220px] items-end gap-4 border-b border-border pt-7">
                {pairColumns.columns.map((col) => (
                  <div
                    key={col.key}
                    className={cn(
                      'flex h-full min-w-0 flex-1 flex-col items-center justify-end',
                      col.key === 'unmatched' && 'ml-3',
                    )}
                    title={`${col.label} · ${col.count} transfers`}
                  >
                    <span className="mb-2 font-mono text-xs font-semibold tabular-nums">
                      {col.count.toLocaleString('en-US')}
                    </span>
                    <div
                      className={cn(
                        'w-full rounded-t-[3px]',
                        pairColumns.columns.length <= 3
                          ? 'max-w-[88px]'
                          : pairColumns.columns.length <= 5
                            ? 'max-w-[64px]'
                            : 'max-w-[54px]',
                        col.muted ? 'bg-muted-foreground/30' : 'bg-primary',
                      )}
                      style={{
                        height: `${Math.max(1.5, (col.count / pairColumns.max) * 88)}%`,
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-4 pt-2.5">
                {pairColumns.columns.map((col) => (
                  <div
                    key={col.key}
                    className={cn(
                      'min-w-0 flex-1 text-center',
                      col.key === 'unmatched' && 'ml-3',
                    )}
                  >
                    <div className="truncate font-mono text-[11px] text-muted-foreground">
                      {col.label}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {col.note ??
                        `${pairColumns.total ? Math.round((col.count / pairColumns.total) * 100) : 0}%`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </PanelCard>

        <PanelCard
          title="Liquidity risk"
          subtitle="Live · lowest coverage first"
          action={
            criticalPools ? (
              <Button
                variant="link"
                size="sm"
                onClick={() => router.push('/liquidity/pool')}
              >
                View all
              </Button>
            ) : undefined
          }
          loading={summaryQ.isLoading}
          error={summaryQ.isError}
          empty={
            summary?.lowPools.length
              ? undefined
              : 'All pools are above their alert threshold.'
          }
        >
          <div className="flex flex-col">
            {summary?.lowPools.map((pool) => {
              const ratio = Number(pool.ratio);
              const percent = Number.isFinite(ratio)
                ? Math.round(ratio * 100)
                : undefined;
              return (
                <div
                  key={pool.poolId}
                  className="border-b border-border py-2.5 first:pt-0 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="min-w-0 max-w-[42%] shrink-0 truncate text-[13px] font-medium"
                      title={pool.accountAddress}
                    >
                      {pool.lpName}{' '}
                      <span className="font-normal text-muted-foreground">
                        {pool.tokenSymbol}
                      </span>
                    </span>
                    <span className="relative h-1.5 min-w-[48px] flex-1 rounded bg-muted">
                      <span
                        className={cn(
                          'absolute inset-y-0 left-0 rounded',
                          pool.lackType === 'AUTH'
                            ? 'bg-warning'
                            : 'bg-destructive',
                        )}
                        style={{
                          width: `${Math.max(0, Math.min(100, percent ?? 0))}%`,
                        }}
                      />
                      {/* 20% 告警竖线：与资金池页、后端监控同一条线 */}
                      <span
                        className="absolute -top-1 bottom-[-3px] w-px bg-foreground/40"
                        style={{ left: `${COVERAGE_ALERT_PERCENT}%` }}
                        title={`Alert line ${COVERAGE_ALERT_PERCENT}% (LP is notified below it)`}
                      />
                    </span>
                    <span className="w-9 shrink-0 text-right font-mono text-xs font-semibold tabular-nums">
                      {percent == null ? '—' : `${percent}%`}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <ProtoStatusBadge
                      tone={pool.lackType === 'AUTH' ? 'warning' : 'danger'}
                    >
                      {pool.lackType === 'AUTH'
                        ? 'Insufficient auth'
                        : 'Insufficient balance'}
                    </ProtoStatusBadge>
                    <span className="text-[11px] text-muted-foreground">
                      Below line by{' '}
                      <span className="tabular-nums">
                        {trimAmount(pool.shortfall)} {pool.tokenSymbol}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {summary && criticalPools > summary.lowPools.length && (
            <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
              {criticalPools} pools below threshold; showing the lowest{' '}
              {summary.lowPools.length}.
            </p>
          )}
        </PanelCard>
      </section>
    </div>
  );
}
