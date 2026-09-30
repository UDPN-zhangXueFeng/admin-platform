'use client';

import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Alert, AlertTitle, Button, Card, Skeleton } from '@myorg/shared/ui';
import { useRouter } from '@myorg/shared/util-i18n';
import {
  KISSEN_PROJECT_ID,
  useDashboardSummaryQuery,
  useDashboardPairDistQuery,
  useDashboardTrendQuery,
  type ExceptionGroupKey,
} from '@myorg/modules/kissen-admin/data-access';
import { CopyableId, ProtoStatusBadge } from './proto-ui';
import { formatUtc8 } from './proto-format';

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
          {days === 1 ? 'Today' : `Last ${days} days`}
        </Button>
      ))}
    </div>
  );
}

function Panel({
  title,
  action,
  loading,
  error,
  empty,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  loading: boolean;
  error: boolean;
  empty?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="h-full min-w-0 p-4 min-[1600px]:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {loading ? (
        <Skeleton className="h-48 w-full" />
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

const EXCEPTION_GROUPS: { key: ExceptionGroupKey; label: string }[] = [
  { key: 'PENDING', label: 'Requires manual handling' },
  { key: 'REVERSED', label: 'Reversed (including reversing)' },
  { key: 'FAILED', label: 'Failed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

export function DashboardPage() {
  const router = useRouter();
  const [pairDays, setPairDays] = React.useState(1);
  const [trendDays, setTrendDays] = React.useState(7);
  const [exceptionDays, setExceptionDays] = React.useState(1);
  const [hidden, setHidden] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const summaryQ = useDashboardSummaryQuery(KISSEN_PROJECT_ID);
  const pairQ = useDashboardPairDistQuery(KISSEN_PROJECT_ID, pairDays);
  const trendQ = useDashboardTrendQuery(KISSEN_PROJECT_ID, trendDays);
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
  const pairs = pairQ.data ?? [];
  const total = pairs.reduce((sum, row) => sum + row.txCount, 0);
  const max = Math.max(1, ...pairs.map((row) => row.txCount));
  const bars = pairs
    .slice(0, 10)
    .map((row) => ({
      ...row,
      label: row.pairId === 0 ? 'Unmatched pair' : row.label,
    }));
  if (pairs.length > 10)
    bars.push({
      pairId: -1,
      pairCode: null,
      label: `Other (${pairs.length - 10} pairs)`,
      txCount: pairs.slice(10).reduce((sum, row) => sum + row.txCount, 0),
    });
  // UTC+8 calendar dates match the aggregation API even outside the operating timezone.
  const trendData = React.useMemo(() => {
    const today = Math.floor((Date.now() + 8 * 3600000) / 86400000) * 86400000;
    const byDay = new Map((trendQ.data ?? []).map((row) => [row.day, row]));
    return Array.from({ length: trendDays }, (_, i) => {
      const day = new Date(today - (trendDays - i - 1) * 86400000)
        .toISOString()
        .slice(0, 10);
      return {
        day,
        total: byDay.get(day)?.total ?? 0,
        exception: byDay.get(day)?.exception ?? 0,
      };
    });
  }, [trendQ.data, trendDays, trendQ.dataUpdatedAt]);
  const cards = [
    {
      label: 'Banks',
      value: summary?.stats.banks,
      caption: 'Active onboarded banks',
      to: '/onboard/bank',
    },
    {
      label: 'Liquidity Providers',
      value: summary?.stats.lps,
      caption: 'Active onboarded providers',
      to: '/onboard/lp',
    },
    {
      label: 'Tokens',
      value: summary?.stats.tokens,
      caption: 'Active tokens',
      to: '/onboard/token',
    },
    {
      label: 'Token Pairs',
      value: summary?.stats.pairs,
      caption: 'Enabled token pairs',
      to: '/fx-rate/pair',
    },
    {
      label: "Today's Transactions",
      value: summary?.stats.txToday,
      caption: 'All statuses · UTC+8',
      to: '/transfer/tx',
    },
  ];
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="t-page-title">Dashboard</h1>
        <div className="flex items-center gap-3">
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
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 min-[1600px]:grid-cols-5">
        {cards.map((card) => (
          <Card key={card.label} className="p-4 min-[1600px]:p-6">
            <button
              className="w-full rounded text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              onClick={() => router.push(card.to)}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {card.label}
              </p>
              <div className="my-3 text-3xl font-semibold tabular-nums">
                {summaryQ.isLoading ? (
                  <Skeleton className="h-9 w-12" />
                ) : summaryQ.isError ? (
                  '—'
                ) : (
                  (card.value ?? 0).toLocaleString('en-US')
                )}
              </div>
              <p className="text-xs text-muted-foreground">{card.caption}</p>
            </button>
          </Card>
        ))}
      </section>
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <Panel
            title="Transactions by Pair"
            action={
              <WindowSelector
                value={pairDays}
                options={[1, 7, 30]}
                onChange={setPairDays}
              />
            }
            loading={pairQ.isLoading}
            error={pairQ.isError}
            empty={
              !pairs.length ? 'No transactions in this window.' : undefined
            }
          >
            <div className="space-y-3">
              {bars.map((row) => (
                <div
                  key={row.pairId}
                  title={`${row.pairCode ?? row.label} · ${row.txCount} transactions`}
                  className="grid grid-cols-[minmax(70px,130px)_1fr_40px_40px] items-center gap-3 text-xs"
                >
                  <span className="truncate">{row.label}</span>
                  <div className="h-4">
                    <div
                      className={
                        row.pairId === -1
                          ? 'h-full rounded-sm bg-primary/40'
                          : 'h-full rounded-sm bg-primary'
                      }
                      style={{
                        width: `${Math.min(100, (row.txCount / max) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-right tabular-nums">{row.txCount}</span>
                  <span className="text-right tabular-nums text-muted-foreground">
                    {total
                      ? `${Math.round((row.txCount / total) * 100)}%`
                      : '—'}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
        <Panel
          title="Liquidity Watch"
          action={
            !!summary?.lowPools.length && (
              <Button
                variant="link"
                size="sm"
                onClick={() => router.push('/liquidity/pool')}
              >
                View all
              </Button>
            )
          }
          loading={summaryQ.isLoading}
          error={summaryQ.isError}
          empty={
            !summary?.lowPools.length
              ? 'All pools have normal liquidity levels.'
              : undefined
          }
        >
          <div className="divide-y divide-border">
            {summary?.lowPools.map((pool) => {
              const ratio = Number(pool.ratio);
              const percent = Number.isFinite(ratio)
                ? Math.round(ratio * 100)
                : undefined;
              return (
                <div key={pool.poolId} className="space-y-2 py-3 first:pt-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-medium">
                      {pool.lpName}{' '}
                      <span className="text-muted-foreground">
                        {pool.tokenSymbol}
                      </span>
                    </span>
                    <span className="tabular-nums">
                      {pool.available} {pool.tokenSymbol}
                    </span>
                  </div>
                  <CopyableId value={pool.accountAddress} />
                  <div className="flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{
                          width: `${Math.max(0, Math.min(100, percent ?? 0))}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs tabular-nums">
                      {percent == null ? '—' : `${percent}%`}
                    </span>
                    <ProtoStatusBadge
                      tone={pool.lackType === 'AUTH' ? 'warning' : 'danger'}
                    >
                      {pool.lackType === 'AUTH'
                        ? 'Insufficient Auth'
                        : 'Insufficient Balance'}
                    </ProtoStatusBadge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Shortfall:{' '}
                    <span className="tabular-nums">
                      {pool.shortfall} {pool.tokenSymbol}
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
          {summary && summary.criticalPoolTotal > summary.lowPools.length && (
            <p className="mt-3 text-xs text-muted-foreground">
              {summary.criticalPoolTotal} critical pools; showing the lowest{' '}
              {summary.lowPools.length}.
            </p>
          )}
        </Panel>
        <div className="min-w-0 lg:col-span-2">
          <Panel
            title="Transaction Trend · Daily counts · UTC+8"
            action={
              <WindowSelector
                value={trendDays}
                options={[7, 14, 30]}
                onChange={setTrendDays}
              />
            }
            loading={trendQ.isLoading}
            error={trendQ.isError}
          >
            <div
              className="h-64"
              role="img"
              aria-label="Daily transaction and exception counts"
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendData}>
                  <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickFormatter={(value) => String(value).slice(5)}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      color: 'hsl(var(--foreground))',
                    }}
                  />
                  {!hidden.has('total') && (
                    <Area
                      type="monotone"
                      dataKey="total"
                      name="All transactions"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.15}
                    />
                  )}
                  {!hidden.has('exception') && (
                    <Line
                      type="monotone"
                      dataKey="exception"
                      name="Exceptions"
                      stroke="hsl(var(--destructive))"
                      dot={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {['total', 'exception'].map((key) => (
                <Button
                  key={key}
                  size="sm"
                  variant={hidden.has(key) ? 'outline' : 'secondary'}
                  aria-pressed={!hidden.has(key)}
                  onClick={() =>
                    setHidden((prev) => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    })
                  }
                >
                  {key === 'total' ? 'All transactions' : 'Exceptions'}
                </Button>
              ))}
              <span className="text-xs text-muted-foreground">
                Today is in progress
              </span>
            </div>
            {hidden.size === 2 && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                All series hidden. Select a legend to restore.
              </p>
            )}
          </Panel>
        </div>
        <Panel
          title="Exception Statistics"
          action={
            <WindowSelector
              value={exceptionDays}
              options={[1, 7]}
              onChange={setExceptionDays}
            />
          }
          loading={summaryQ.isLoading}
          error={summaryQ.isError}
        >
          <p className="mb-4 text-sm text-muted-foreground">
            Total exceptions{' '}
            <span className="ml-3 text-2xl font-semibold tabular-nums text-foreground">
              {exceptionDays === 1
                ? summary?.exceptions.today
                : summary?.exceptions.week}
            </span>
          </p>
          <div className="divide-y divide-border">
            {EXCEPTION_GROUPS.map((group) => (
              <div
                key={group.key}
                className="flex justify-between gap-2 py-3 text-sm"
              >
                <span>{group.label}</span>
                <span className="tabular-nums">
                  {summary?.exceptions.groups.find(
                    (row) => row.key === group.key,
                  )?.[exceptionDays === 1 ? 'today' : 'week'] ?? 0}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">
              Last 7 days: {summary?.exceptions.week}
            </span>
            <Button
              variant="link"
              size="sm"
              onClick={() => router.push('/transfer/tx?status=70')}
            >
              View details
            </Button>
          </div>
        </Panel>
      </section>
    </div>
  );
}
