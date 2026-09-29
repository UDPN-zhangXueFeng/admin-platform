'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  Coins,
  Landmark,
  RefreshCw,
  Users,
} from 'lucide-react';

import {
  Button,
  Card,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@myorg/shared/ui';
import { cn } from '@myorg/shared/util-classnames';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  KISSEN_PROJECT_ID,
  kissenPage,
  useInstanceListQuery,
  useLpListQuery,
  useTokenListQuery,
  useTokenPairListAllQuery,
} from '@myorg/modules/kissen-admin/data-access';

import { formatTokenAmount, formatUtc8 } from './proto-format';
import { CopyableId, ProtoStatusBadge } from './proto-ui';
import { ProtoSortHeader, useProtoSort } from './proto-sort';

const PAGE_SIZE = 200;
const DAY_MS = 24 * 60 * 60 * 1000;
const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000;

interface WorkbenchTxRow {
  transactionId: number;
  pairId?: number;
  sourceCurrency: string;
  targetCurrency: string;
  status: number;
  createTime: number;
}

interface WorkbenchBankRow {
  bankId: number;
  bankName: string;
  status: number;
  createTime: number;
}

interface WorkbenchPoolRow {
  poolId: number;
  lpId: number;
  lpName: string;
  tokenId: number;
  tokenCode: string;
  tokenSymbol: string;
  accountAddress?: string;
  requiredMinSum: string | number | null;
  remindThreshold: string | number;
  availableBalanceCache: string | number;
  preauthAvailable: string | number | null;
  status: number;
}

interface WorkbenchPageResp<T> {
  data: T[];
  pagination: { total: number };
}

interface PairTransactionCount {
  key: string;
  pairId?: number;
  label: string;
  count: number;
}

interface TodaySummary {
  total: number;
  exceptionCount: number;
  pairs: PairTransactionCount[];
}

interface TrendPoint {
  label: string;
  count: number;
}

interface Utc8DayRange extends TrendPoint {
  start: number;
  end: number;
}

const workbenchKeys = {
  all: (projectId: string) => ['project', projectId, 'workbench'] as const,
  today: (projectId: string, dayStart: number) =>
    [...workbenchKeys.all(projectId), 'today', dayStart] as const,
  banks: (projectId: string) =>
    [...workbenchKeys.all(projectId), 'banks'] as const,
  exceptions: (projectId: string) =>
    [...workbenchKeys.all(projectId), 'exceptions'] as const,
  pools: (projectId: string) =>
    [...workbenchKeys.all(projectId), 'pools'] as const,
  trend: (projectId: string, dayStart: number) =>
    [...workbenchKeys.all(projectId), 'trend', dayStart] as const,
} as const;

function utc8DayStart(timestamp: number): number {
  const shifted = new Date(timestamp + UTC8_OFFSET_MS);
  return (
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ) - UTC8_OFFSET_MS
  );
}

function utc8DayLabel(dayStart: number): string {
  return new Date(dayStart + UTC8_OFFSET_MS).toISOString().slice(5, 10);
}

function formatAge(timestamp: number): string {
  if (!timestamp) return '-';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 60) return minutes + 'm';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ' + (minutes % 60) + 'm';
  return Math.floor(hours / 24) + 'd ' + (hours % 24) + 'h';
}

function latestByTime<T>(
  rows: T[],
  getTime: (row: T) => number,
): T | undefined {
  return rows.reduce<T | undefined>(
    (latest, row) =>
      getTime(row) > (latest ? getTime(latest) : 0) ? row : latest,
    undefined,
  );
}

function recentUtc8Days(count: number, now: number): Utc8DayRange[] {
  const todayStart = utc8DayStart(now);
  return Array.from({ length: count }, (_, index) => {
    const start = todayStart - (count - index - 1) * DAY_MS;
    return {
      start,
      end: Math.min(start + DAY_MS, now + 1),
      label: utc8DayLabel(start),
      count: 0,
    };
  });
}

async function fetchAllPages<T>(
  url: string,
  filter: Record<string, number>,
  signal: AbortSignal,
): Promise<WorkbenchPageResp<T>> {
  const firstPage = await kissenPage<T>(
    url,
    { pageNum: 1, pageSize: PAGE_SIZE, filter },
    { signal },
  );
  const pageCount = Math.ceil(firstPage.pagination.total / PAGE_SIZE);

  if (pageCount <= 1) return firstPage;

  const remainingPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      kissenPage<T>(
        url,
        { pageNum: index + 2, pageSize: PAGE_SIZE, filter },
        { signal },
      ),
    ),
  );

  return {
    ...firstPage,
    data: [...firstPage.data, ...remainingPages.flatMap((page) => page.data)],
  };
}

function useWorkbenchTodayQuery(projectId: string) {
  const now = Date.now();
  const start = utc8DayStart(now);

  return useQuery({
    queryKey: workbenchKeys.today(projectId, start),
    queryFn: async ({ signal }): Promise<TodaySummary> => {
      const result = await fetchAllPages<WorkbenchTxRow>(
        '/manage/transaction/page',
        { createTimeStart: start, createTimeEnd: now },
        signal,
      );
      const pairs = new Map<string, PairTransactionCount>();
      let exceptionCount = 0;

      for (const row of result.data) {
        if (row.status === 70) exceptionCount += 1;

        const key =
          row.pairId && row.pairId > 0
            ? 'pair:' + row.pairId
            : 'tokens:' +
              (row.sourceCurrency || '-') +
              '→' +
              (row.targetCurrency || '-');
        const previous = pairs.get(key);
        pairs.set(key, {
          key,
          pairId: row.pairId,
          label:
            row.sourceCurrency && row.targetCurrency
              ? row.sourceCurrency + ' → ' + row.targetCurrency
              : 'Token pair ' + (row.pairId ?? 'unknown'),
          count: (previous?.count ?? 0) + 1,
        });
      }

      return {
        total: result.pagination.total,
        exceptionCount,
        pairs: [...pairs.values()].sort((a, b) => b.count - a.count),
      };
    },
  });
}

function useWorkbenchBankCountQuery(projectId: string) {
  return useQuery({
    queryKey: workbenchKeys.banks(projectId),
    queryFn: ({ signal }) =>
      kissenPage<WorkbenchBankRow>(
        '/manage/bank/list',
        {
          pageNum: 1,
          pageSize: PAGE_SIZE,
          filter: { status: 20 },
        },
        { signal },
      ),
  });
}

function useWorkbenchExceptionCountQuery(projectId: string) {
  return useQuery({
    queryKey: workbenchKeys.exceptions(projectId),
    queryFn: ({ signal }) =>
      kissenPage(
        '/manage/transaction/page',
        {
          pageNum: 1,
          pageSize: 1,
          filter: { status: 70 },
        },
        { signal },
      ),
  });
}

function useWorkbenchPoolsQuery(projectId: string) {
  return useQuery({
    queryKey: workbenchKeys.pools(projectId),
    queryFn: ({ signal }) =>
      fetchAllPages<WorkbenchPoolRow>('/manage/lp-pool/list', {}, signal),
  });
}

function useWorkbenchTrendQuery(projectId: string) {
  const now = Date.now();
  const todayStart = utc8DayStart(now);

  return useQuery({
    queryKey: workbenchKeys.trend(projectId, todayStart),
    queryFn: async ({ signal }): Promise<TrendPoint[]> => {
      const days = recentUtc8Days(7, Date.now());
      return Promise.all(
        days.map(async (day) => {
          const result = await kissenPage<WorkbenchTxRow>(
            '/manage/transaction/page',
            {
              pageNum: 1,
              pageSize: 1,
              filter: {
                createTimeStart: day.start,
                createTimeEnd: day.end,
              },
            },
            { signal },
          );
          return { label: day.label, count: result.pagination.total };
        }),
      );
    },
  });
}

function InfoTip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={label}
          tabIndex={0}
          className="inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground"
        >
          i
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-xs leading-relaxed">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

function PanelHeading({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {action && onAction ? (
        <Button
          variant="link"
          size="sm"
          className="h-auto shrink-0 p-0 text-xs font-semibold"
          onClick={onAction}
        >
          {action}
        </Button>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  tip,
  icon: Icon,
  value,
  isLoading,
  isError,
}: {
  label: string;
  tip: string;
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  isLoading: boolean;
  isError: boolean;
}) {
  return (
    <Card className="rounded-[10px] border-t-2 border-t-primary p-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        <span>{label}</span>
        <InfoTip label={label + ' definition'}>{tip}</InfoTip>
      </div>
      <div className="mt-2 text-3xl font-bold leading-none tracking-tight tabular-nums">
        {isLoading ? (
          <Skeleton className="h-9 w-16" />
        ) : isError ? (
          '—'
        ) : (
          value.toLocaleString('en-US')
        )}
      </div>
    </Card>
  );
}

function BlockMessage({
  text,
  onRetry,
}: {
  text: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-20 items-center justify-between gap-3 text-sm text-muted-foreground">
      <span>{text}</span>
      {onRetry ? (
        <Button
          variant="link"
          size="sm"
          className="h-auto shrink-0 p-0"
          onClick={onRetry}
        >
          Retry
        </Button>
      ) : null}
    </div>
  );
}

function TokenPairTransactions({
  pairs,
  pairNames,
  total,
  isLoading,
  isError,
  onRetry,
}: {
  pairs: PairTransactionCount[];
  pairNames: ReadonlyMap<number, string>;
  total: number;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const visiblePairs = pairs.slice(0, 8);
  const maxCount = Math.max(...visiblePairs.map((pair) => pair.count), 0);

  return (
    <Card className="h-full min-w-0 rounded-[10px] p-5">
      <PanelHeading title="Today's Transactions by Token Pair" />
      {isError ? (
        <BlockMessage
          text="Unable to load today's transactions."
          onRetry={onRetry}
        />
      ) : isLoading ? (
        <div className="flex flex-col gap-4">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-6 w-full" />
          ))}
        </div>
      ) : visiblePairs.length === 0 ? (
        <BlockMessage text="No transactions today." />
      ) : (
        <>
          <div
            className="flex flex-col gap-4"
            role="list"
            aria-label="Transactions by token pair"
          >
            {visiblePairs.map((pair) => {
              const label =
                pair.pairId != null
                  ? pairNames.get(pair.pairId) || pair.label
                  : pair.label;
              const width = Math.max(3, (pair.count / maxCount) * 100);

              return (
                <div
                  key={pair.key}
                  role="listitem"
                  className="grid grid-cols-[minmax(7rem,10rem)_1fr_3rem] items-center gap-3"
                >
                  <span className="truncate text-sm font-medium" title={label}>
                    {label}
                  </span>
                  <div className="h-3 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{ width: width + '%' }}
                    />
                  </div>
                  <span className="text-right text-sm font-semibold tabular-nums">
                    {pair.count.toLocaleString('en-US')}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {total.toLocaleString('en-US')} transactions today · showing top{' '}
            {visiblePairs.length} pairs
          </p>
        </>
      )}
    </Card>
  );
}

function poolNumerator(pool: WorkbenchPoolRow): number {
  const balance = Number(pool.availableBalanceCache);
  const preauth =
    pool.preauthAvailable == null ? null : Number(pool.preauthAvailable);
  return preauth != null &&
    Number.isFinite(preauth) &&
    preauth >= 0 &&
    preauth < balance
    ? preauth
    : balance;
}

function poolCoverage(pool: WorkbenchPoolRow): number | null {
  const required = Number(pool.requiredMinSum);
  if (!(required > 0)) return null;
  const ratio = poolNumerator(pool) / required;
  return Number.isFinite(ratio) ? ratio : null;
}

function LowLiquidityProviders({
  pools,
  isLoading,
  isError,
  onRetry,
}: {
  pools: WorkbenchPoolRow[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const lowPools = React.useMemo(() => {
    const lowestByLp = new Map<
      number,
      { pool: WorkbenchPoolRow; coverage: number }
    >();

    for (const pool of pools) {
      const coverage = poolCoverage(pool);
      if (coverage == null || coverage >= Number(pool.remindThreshold)) {
        continue;
      }
      const current = lowestByLp.get(pool.lpId);
      if (!current || coverage < current.coverage) {
        lowestByLp.set(pool.lpId, { pool, coverage });
      }
    }

    return [...lowestByLp.values()]
      .sort((a, b) => a.coverage - b.coverage)
      .slice(0, 5);
  }, [pools]);

  return (
    <Card className="h-full min-w-0 rounded-[10px] p-5">
      <PanelHeading title="Low Liquidity Providers" />
      {isError ? (
        <BlockMessage
          text="Unable to load liquidity levels."
          onRetry={onRetry}
        />
      ) : isLoading ? (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-10 w-full" />
          ))}
        </div>
      ) : lowPools.length === 0 ? (
        <BlockMessage text="No low-liquidity providers." />
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {lowPools.map(({ pool, coverage }) => {
            const percentage = Math.max(0, coverage * 100);
            return (
              <div key={pool.lpId} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-semibold"
                      title={pool.lpName}
                    >
                      {pool.lpName || 'Unnamed LP'}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {pool.tokenSymbol || pool.tokenCode || 'Token'}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-destructive">
                    {percentage.toFixed(1)}%
                  </span>
                </div>
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                  aria-label={
                    'Liquidity coverage ' + percentage.toFixed(1) + '%'
                  }
                >
                  <div
                    className="h-full rounded-full bg-destructive"
                    style={{ width: Math.min(100, percentage) + '%' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function CoverageCell({ pool }: { pool: WorkbenchPoolRow }) {
  const coverage = poolCoverage(pool);
  const critical = coverage != null && coverage < Number(pool.remindThreshold);
  const percentage = coverage == null ? null : Math.round(coverage * 100);
  const fillWidth =
    percentage == null ? 0 : Math.min(100, Math.round(percentage * 0.456));
  const tone =
    percentage != null && percentage <= 0
      ? 'bg-destructive'
      : critical
        ? 'bg-warning'
        : 'bg-success';
  const threshold = Number(pool.remindThreshold);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="relative h-1.5 w-[90px] shrink-0 rounded bg-muted">
        {percentage != null ? (
          <span
            className={cn('absolute inset-y-0 left-0 rounded', tone)}
            style={{ width: fillWidth + '%' }}
          />
        ) : null}
        <span
          className="absolute -inset-y-[3px] w-0.5 bg-muted-foreground/50"
          style={{ left: '45.6%' }}
        />
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="cursor-help text-xs tabular-nums text-muted-foreground"
          >
            {percentage == null ? '—' : percentage + '%'}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-64 text-xs">
          <div>
            min ({formatTokenAmount(pool.availableBalanceCache)},{' '}
            {formatTokenAmount(pool.preauthAvailable)}) ÷{' '}
            {formatTokenAmount(pool.requiredMinSum)} ={' '}
            <strong>{percentage == null ? '—' : percentage + '%'}</strong>
          </div>
          <div>
            Low Liquidity Threshold:{' '}
            {Number.isFinite(threshold)
              ? Math.round(threshold * 100) + '%'
              : '—'}
          </div>
        </TooltipContent>
      </Tooltip>
      <ProtoStatusBadge tone={critical ? 'danger' : 'success'}>
        {critical ? 'Low' : 'Sufficient'}
      </ProtoStatusBadge>
    </div>
  );
}

function PoolOverview({
  pools,
  tokenNames,
  isLoading,
  isError,
  onRetry,
  onViewAll,
}: {
  pools: WorkbenchPoolRow[];
  tokenNames: ReadonlyMap<number, string>;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onViewAll: () => void;
}) {
  const getters = {
    lpName: { value: (pool: WorkbenchPoolRow) => pool.lpName || '—' },
    token: {
      value: (pool: WorkbenchPoolRow) =>
        tokenNames.get(pool.tokenId) || pool.tokenCode || '—',
    },
    walletBalance: {
      value: (pool: WorkbenchPoolRow) => Number(pool.availableBalanceCache),
      defaultDir: 'desc' as const,
    },
    authorizedAmount: {
      value: (pool: WorkbenchPoolRow) =>
        pool.preauthAvailable == null ? null : Number(pool.preauthAvailable),
      defaultDir: 'desc' as const,
    },
  };
  const { sorted, toggle, sortState } = useProtoSort(
    pools,
    getters,
    'lpName',
    'asc',
  );
  const headerClass =
    'whitespace-nowrap border-b border-border px-3 py-2 text-left text-xs font-semibold tracking-wide text-muted-foreground';

  return (
    <Card className="h-full min-w-0 rounded-[10px] p-5">
      <PanelHeading
        title="Pool Overview"
        action={'All pools ' + pools.length + ' →'}
        onAction={onViewAll}
      />
      {isError ? (
        <BlockMessage text="Unable to load pools." onRetry={onRetry} />
      ) : isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-5 w-full" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <BlockMessage text="No pools yet." />
      ) : (
        <div className="max-md:overflow-x-auto md:overflow-hidden">
          <table className="w-full min-w-0 table-fixed border-collapse max-md:min-w-[860px]">
            <thead>
              <tr>
                <th className={cn(headerClass, 'w-[15%]')}>
                  <ProtoSortHeader
                    label="LP Name"
                    columnKey="lpName"
                    toggle={toggle}
                    sortState={sortState('lpName')}
                  />
                </th>
                <th className={cn(headerClass, 'w-[20%]')}>Pool Address</th>
                <th className={cn(headerClass, 'w-[12%]')}>
                  <ProtoSortHeader
                    label="Token Name"
                    columnKey="token"
                    toggle={toggle}
                    sortState={sortState('token')}
                  />
                </th>
                <th className={cn(headerClass, 'w-[16%] text-right')}>
                  <ProtoSortHeader
                    label="Wallet Balance"
                    columnKey="walletBalance"
                    toggle={toggle}
                    sortState={sortState('walletBalance')}
                  />
                </th>
                <th className={cn(headerClass, 'w-[19%] text-right')}>
                  <ProtoSortHeader
                    label="Authorized Amount"
                    columnKey="authorizedAmount"
                    toggle={toggle}
                    sortState={sortState('authorizedAmount')}
                  />
                </th>
                <th className={cn(headerClass, 'w-[18%]')}>
                  <span className="inline-flex items-center gap-1">
                    Liq. Coverage
                    <InfoTip label="Coverage formula">
                      Liquidity Coverage = min (Available Balance, Available
                      Pre-Authorized) ÷ Min. Liquidity
                    </InfoTip>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((pool) => {
                const tokenName =
                  tokenNames.get(pool.tokenId) || pool.tokenCode || '—';
                return (
                  <tr key={pool.poolId} className="hover:bg-muted/40">
                    <td className="border-b border-border px-3 py-2.5 text-sm font-medium">
                      <span className="block truncate" title={pool.lpName}>
                        {pool.lpName || '—'}
                      </span>
                    </td>
                    <td className="border-b border-border px-3 py-2.5 font-mono text-xs">
                      <CopyableId value={pool.accountAddress} />
                    </td>
                    <td className="border-b border-border px-3 py-2.5 text-sm font-semibold">
                      <span className="block truncate" title={tokenName}>
                        {tokenName}
                      </span>
                    </td>
                    <td className="border-b border-border px-3 py-2.5 text-right text-sm tabular-nums">
                      {formatTokenAmount(pool.availableBalanceCache)}
                      <span className="ml-1 text-xs font-medium text-muted-foreground">
                        {pool.tokenSymbol}
                      </span>
                    </td>
                    <td className="border-b border-border px-3 py-2.5 text-right text-sm tabular-nums">
                      {formatTokenAmount(pool.preauthAvailable)}
                      <span className="ml-1 text-xs font-medium text-muted-foreground">
                        {pool.tokenSymbol}
                      </span>
                    </td>
                    <td className="border-b border-border px-3 py-2.5">
                      <CoverageCell pool={pool} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

interface WorkbenchInstanceRow {
  instanceId: number;
  connectivityStatus: number;
  lastHeartbeatTime: number;
}

function NetworkStat({
  name,
  hint,
  value,
}: {
  name: string;
  hint: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{name}</div>
        <div className="mt-px truncate text-xs font-medium text-muted-foreground">
          {hint}
        </div>
      </div>
      <div className="shrink-0 text-right text-xl font-bold tabular-nums">
        {value}
      </div>
    </div>
  );
}

function NetworkOverview({
  banks,
  bankCount,
  lps,
  lpCount,
  pairs,
  instances,
  isBanksError,
  isLpsError,
  isPairsError,
  isInstancesError,
}: {
  banks: WorkbenchBankRow[];
  bankCount: number;
  lps: Array<{ lpId: number; lpName: string; createTime: number }>;
  lpCount: number;
  pairs: Array<{ pairId: number; createTime: number }>;
  instances: WorkbenchInstanceRow[];
  isBanksError: boolean;
  isLpsError: boolean;
  isPairsError: boolean;
  isInstancesError: boolean;
}) {
  const latestBank = latestByTime(banks, (bank) => bank.createTime);
  const latestLp = latestByTime(lps, (lp) => lp.createTime);
  const latestPair = latestByTime(pairs, (pair) => pair.createTime);
  const connected = instances.filter(
    (instance) => instance.connectivityStatus === 1,
  ).length;
  const hasDisconnected = instances.some(
    (instance) => instance.connectivityStatus === 2,
  );
  const lastHeartbeat = instances.reduce(
    (latest, instance) => Math.max(latest, instance.lastHeartbeatTime || 0),
    0,
  );

  return (
    <Card className="h-full min-w-0 rounded-[10px] p-5">
      <PanelHeading title="Network Overview" />
      <NetworkStat
        name="Banks"
        hint={
          isBanksError
            ? 'Unable to load banks'
            : latestBank
              ? 'Latest: ' +
                latestBank.bankName +
                ' · onboarded ' +
                formatUtc8(latestBank.createTime)
              : '—'
        }
        value={isBanksError ? '—' : bankCount.toLocaleString('en-US')}
      />
      <NetworkStat
        name="Gateway Instances"
        hint={
          isInstancesError
            ? 'Unable to load gateway instances'
            : hasDisconnected
              ? 'At least one gateway is disconnected'
              : lastHeartbeat
                ? 'Last heartbeat ' + formatAge(lastHeartbeat) + ' ago'
                : '—'
        }
        value={
          isInstancesError
            ? '—'
            : connected.toLocaleString('en-US') +
              ' / ' +
              instances.length.toLocaleString('en-US')
        }
      />
      <NetworkStat
        name="Liquidity Providers"
        hint={
          isLpsError
            ? 'Unable to load providers'
            : latestLp
              ? 'Latest: ' +
                latestLp.lpName +
                ' · ' +
                formatUtc8(latestLp.createTime)
              : '—'
        }
        value={isLpsError ? '—' : lpCount.toLocaleString('en-US')}
      />
      <NetworkStat
        name="Token Pairs"
        hint={
          isPairsError
            ? 'Unable to load token pairs'
            : latestPair
              ? 'Latest pair added ' + formatUtc8(latestPair.createTime)
              : '—'
        }
        value={isPairsError ? '—' : pairs.length.toLocaleString('en-US')}
      />
    </Card>
  );
}

function TransactionTrend({
  points,
  isLoading,
  isError,
  onRetry,
}: {
  points: TrendPoint[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const left = 38;
  const right = 622;
  const top = 20;
  const bottom = 184;
  const maxCount = Math.max(...points.map((point) => point.count), 0);
  const scaleMax = maxCount || 1;
  const coordinates = points.map((point, index) => ({
    ...point,
    x:
      points.length <= 1
        ? (left + right) / 2
        : left + (index * (right - left)) / (points.length - 1),
    y: bottom - (point.count / scaleMax) * (bottom - top),
  }));
  const linePoints = coordinates
    .map((point) => point.x + ',' + point.y)
    .join(' ');

  return (
    <Card className="h-full min-w-0 rounded-[10px] p-5">
      <PanelHeading title="Transaction Trend · Last 7 Days (UTC+8)" />
      {isError ? (
        <BlockMessage
          text="Unable to load transaction trend."
          onRetry={onRetry}
        />
      ) : isLoading ? (
        <Skeleton className="h-56 w-full" />
      ) : (
        <svg
          viewBox="0 0 640 232"
          role="img"
          aria-label="Daily transaction count over the last seven days"
          className="h-56 w-full overflow-visible text-muted-foreground"
          preserveAspectRatio="none"
        >
          {[0, 1, 2, 3].map((step) => {
            const y = top + (step * (bottom - top)) / 3;
            const tick = Math.round((scaleMax * (3 - step)) / 3);
            return (
              <g key={step}>
                <line
                  x1={left}
                  y1={y}
                  x2={right}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity="0.15"
                  strokeDasharray="3 4"
                />
                <text
                  x="30"
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="currentColor"
                >
                  {tick}
                </text>
              </g>
            );
          })}
          {coordinates.length > 1 ? (
            <polyline
              points={linePoints}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {coordinates.map((point) => (
            <g key={point.label}>
              <circle
                cx={point.x}
                cy={point.y}
                r="4"
                fill="hsl(var(--primary))"
              >
                <title>
                  {point.label}: {point.count} transactions
                </title>
              </circle>
              <text
                x={point.x}
                y={bottom + 22}
                textAnchor="middle"
                fontSize="10"
                fill="currentColor"
              >
                {point.label}
              </text>
            </g>
          ))}
        </svg>
      )}
    </Card>
  );
}

function ExceptionStatistics({
  total,
  today,
  todayTransactions,
  isExceptionsLoading,
  isExceptionsError,
  isTodayLoading,
  isTodayError,
  onRetry,
}: {
  total: number;
  today: number;
  todayTransactions: number;
  isExceptionsLoading: boolean;
  isExceptionsError: boolean;
  isTodayLoading: boolean;
  isTodayError: boolean;
  onRetry: () => void;
}) {
  const rate =
    todayTransactions > 0
      ? ((today / todayTransactions) * 100).toFixed(1) + '%'
      : '0.0%';

  return (
    <Card className="h-full min-w-0 rounded-[10px] p-5">
      <PanelHeading title="Exception Transaction Statistics" />
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <AlertTriangle
            className="size-4 text-destructive"
            aria-hidden="true"
          />
          Current exceptions
        </div>
        <div className="mt-2 text-3xl font-bold tabular-nums text-destructive">
          {isExceptionsLoading ? (
            <Skeleton className="h-9 w-16" />
          ) : isExceptionsError ? (
            '—'
          ) : (
            total.toLocaleString('en-US')
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Transactions currently in Exception status
        </p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Exceptions today</p>
          <p className="mt-1 text-xl font-bold tabular-nums">
            {isTodayLoading ? (
              <Skeleton className="h-6 w-12" />
            ) : isTodayError ? (
              '—'
            ) : (
              today.toLocaleString('en-US')
            )}
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Today's rate</p>
          <p className="mt-1 text-xl font-bold tabular-nums">
            {isTodayLoading || isTodayError ? (
              isTodayError ? (
                '—'
              ) : (
                <Skeleton className="h-6 w-12" />
              )
            ) : (
              rate
            )}
          </p>
        </div>
      </div>
      {isExceptionsError || isTodayError ? (
        <div className="mt-3 flex justify-end">
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={onRetry}
          >
            Retry
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

export function DashboardPage() {
  const router = useRouter();
  const banksQ = useWorkbenchBankCountQuery(KISSEN_PROJECT_ID);
  const lpsQ = useLpListQuery(KISSEN_PROJECT_ID, {
    pageNum: 1,
    pageSize: PAGE_SIZE,
    filter: { status: 20 },
  });
  const instancesQ = useInstanceListQuery(KISSEN_PROJECT_ID, {
    pageNum: 1,
    pageSize: PAGE_SIZE,
    filter: { status: 20 },
  });
  const tokensQ = useTokenListQuery(KISSEN_PROJECT_ID, { status: 20 });
  const tokenPairsQ = useTokenPairListAllQuery(KISSEN_PROJECT_ID, {
    status: 20,
  });
  const todayQ = useWorkbenchTodayQuery(KISSEN_PROJECT_ID);
  const exceptionsQ = useWorkbenchExceptionCountQuery(KISSEN_PROJECT_ID);
  const poolsQ = useWorkbenchPoolsQuery(KISSEN_PROJECT_ID);
  const trendQ = useWorkbenchTrendQuery(KISSEN_PROJECT_ID);

  const refreshing = [
    banksQ.isFetching,
    lpsQ.isFetching,
    tokensQ.isFetching,
    tokenPairsQ.isFetching,
    todayQ.isFetching,
    exceptionsQ.isFetching,
    poolsQ.isFetching,
    trendQ.isFetching,
    instancesQ.isFetching,
  ].some(Boolean);

  const handleRefresh = React.useCallback(() => {
    void Promise.all([
      banksQ.refetch(),
      lpsQ.refetch(),
      tokensQ.refetch(),
      tokenPairsQ.refetch(),
      todayQ.refetch(),
      exceptionsQ.refetch(),
      poolsQ.refetch(),
      trendQ.refetch(),
      instancesQ.refetch(),
    ]);
  }, [
    banksQ,
    lpsQ,
    tokensQ,
    tokenPairsQ,
    todayQ,
    exceptionsQ,
    poolsQ,
    trendQ,
    instancesQ,
  ]);

  const pairNames = React.useMemo(
    () =>
      new Map(
        (tokenPairsQ.data ?? []).map((pair) => [
          pair.pairId,
          (pair.sourceSymbol || pair.sourceTokenCode) +
            ' → ' +
            (pair.targetSymbol || pair.targetTokenCode),
        ]),
      ),
    [tokenPairsQ.data],
  );
  const latestUpdatedAt = Math.max(
    banksQ.dataUpdatedAt,
    lpsQ.dataUpdatedAt,
    tokensQ.dataUpdatedAt,
    tokenPairsQ.dataUpdatedAt,
    todayQ.dataUpdatedAt,
    exceptionsQ.dataUpdatedAt,
    poolsQ.dataUpdatedAt,
    trendQ.dataUpdatedAt,
    instancesQ.dataUpdatedAt,
  );
  const todaySummary = todayQ.data;
  const bankRows = banksQ.data?.data ?? [];
  const lpRows = lpsQ.data?.data ?? [];
  const pairRows = tokenPairsQ.data ?? [];
  const instanceRows = instancesQ.data?.data ?? [];
  const pools = poolsQ.data?.data ?? [];
  const tokenNames = React.useMemo(
    () =>
      new Map(
        (tokensQ.data ?? [])
          .filter((token) => token.tokenName?.trim())
          .map((token) => [token.tokenId, token.tokenName.trim()]),
      ),
    [tokensQ.data],
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-4">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="t-page-title">Dashboard</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Updated {latestUpdatedAt ? formatUtc8(latestUpdatedAt) : '—'}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw
                className={cn('size-4', refreshing && 'animate-spin')}
                aria-hidden="true"
              />
              Refresh
            </Button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 min-[1600px]:grid-cols-5">
          <MetricCard
            label="Banks"
            tip="Onboarded banks with active status."
            icon={Landmark}
            value={banksQ.data?.pagination.total ?? 0}
            isLoading={banksQ.isLoading}
            isError={banksQ.isError}
          />
          <MetricCard
            label="Liquidity Providers"
            tip="Approved liquidity providers with active status."
            icon={Users}
            value={lpsQ.data?.pagination.total ?? 0}
            isLoading={lpsQ.isLoading}
            isError={lpsQ.isError}
          />
          <MetricCard
            label="Tokens"
            tip="Active tokens."
            icon={Coins}
            value={tokensQ.data?.length ?? 0}
            isLoading={tokensQ.isLoading}
            isError={tokensQ.isError}
          />
          <MetricCard
            label="Token Pairs"
            tip="Enabled token pairs."
            icon={ArrowLeftRight}
            value={tokenPairsQ.data?.length ?? 0}
            isLoading={tokenPairsQ.isLoading}
            isError={tokenPairsQ.isError}
          />
          <MetricCard
            label="Today's Transactions"
            tip="Transactions created today, from 00:00 to now in UTC+8."
            icon={Activity}
            value={todaySummary?.total ?? 0}
            isLoading={todayQ.isLoading}
            isError={todayQ.isError}
          />
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-8">
            <PoolOverview
              pools={pools}
              tokenNames={tokenNames}
              isLoading={poolsQ.isLoading}
              isError={poolsQ.isError}
              onRetry={() => poolsQ.refetch()}
              onViewAll={() => router.push('/liquidity/pool')}
            />
          </div>
          <div className="min-w-0 lg:col-span-4">
            <NetworkOverview
              banks={bankRows}
              bankCount={banksQ.data?.pagination.total ?? 0}
              lps={lpRows}
              lpCount={lpsQ.data?.pagination.total ?? 0}
              pairs={pairRows}
              instances={instanceRows}
              isBanksError={banksQ.isError}
              isLpsError={lpsQ.isError}
              isPairsError={tokenPairsQ.isError}
              isInstancesError={instancesQ.isError}
            />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-8">
            <TokenPairTransactions
              pairs={todaySummary?.pairs ?? []}
              pairNames={pairNames}
              total={todaySummary?.total ?? 0}
              isLoading={todayQ.isLoading}
              isError={todayQ.isError}
              onRetry={() => todayQ.refetch()}
            />
          </div>
          <div className="min-w-0 lg:col-span-4">
            <LowLiquidityProviders
              pools={pools.filter((pool) => pool.status === 20)}
              isLoading={poolsQ.isLoading}
              isError={poolsQ.isError}
              onRetry={() => poolsQ.refetch()}
            />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-8">
            <TransactionTrend
              points={trendQ.data ?? []}
              isLoading={trendQ.isLoading}
              isError={trendQ.isError}
              onRetry={() => trendQ.refetch()}
            />
          </div>
          <div className="min-w-0 lg:col-span-4">
            <ExceptionStatistics
              total={exceptionsQ.data?.pagination.total ?? 0}
              today={todaySummary?.exceptionCount ?? 0}
              todayTransactions={todaySummary?.total ?? 0}
              isExceptionsLoading={exceptionsQ.isLoading}
              isExceptionsError={exceptionsQ.isError}
              isTodayLoading={todayQ.isLoading}
              isTodayError={todayQ.isError}
              onRetry={handleRefresh}
            />
          </div>
        </section>
      </div>
    </TooltipProvider>
  );
}
