'use client';

/**
 * Dashboard（BP 原型 DashboardPage 对齐改造，GAP-GW-03 + plan/12 §5）。
 *
 * 原型 2026-09-21 改版后的三段结构：
 *   ① 页头：健康点（All systems normal / System issues detected）+ As of + Refresh
 *   ② Business Snapshot：4 KPI 卡（顶部色条 + label/ⓘ 口径提示 + 大数值 + help 脚注）
 *   ③ Transaction Trends：笔数 / 金额 / Token Pair，支持 7 / 14 / 30 天
 *
 * KPI/图表数据源：
 * - Active Tokens = /token/list 真算（status=20 计 active）
 * - Transactions (24h) = /overview CUSTOM 滚动 24h 窗口真算
 * - Connected Banks = 静态补齐（无银行连接统计端点，不虚构）
 * - Token Pairs = /fx/view 真算（tokenPair.status=20 计 enabled）
 * - 趋势笔数与 Token Pair = /overview volumeSeries
 * - 金额只展示 API 返回的所选区间源端/目标端合计；接口无逐日金额序列
 * 图表使用 recharts（既有依赖）。
 */

import * as React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Info, RefreshCw } from 'lucide-react';

import {
  Button,
  Card,
  CardContent,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@myorg/shared/ui';

import {
  useFxViewQuery,
  useOverviewStatsQuery,
  useTokenListQuery,
} from '@myorg/modules/kissen-gateway/data-access';

import { formatUtc8 } from './proto-format';
import type { ProtoStatusTone } from './proto-ui';
import { PageHead } from './page-head';
import { EmptyHint, ErrorBlock } from './state-blocks';

/* ================================================================== */
/* 文案（原型 DashboardPage.jsx 英文 copy 逐字；插值 {var}）              */
/* ================================================================== */

const LBL = {
  title: 'Dashboard',
  systemOk: 'All systems normal',
  systemIssue: 'System issues detected',
  asOf: 'As of',
  refresh: 'Refresh',
  snapshot: 'Business Snapshot',
  kpiActiveTokens: 'Active Tokens',
  kpiActiveTokensTip:
    'All network-registered tokens this bank can distribute; the number shows active ones.',
  kpiActiveTokensHelp: '{active} of {total} registered tokens',
  kpiTx24h: 'Transactions (24h)',
  kpiTx24hTip:
    'Transactions initiated by your bank in the last 24 hours; completed vs failed below.',
  kpiTx24hHelp: '{completed} completed · {failed} failed in the last 24 hours',
  kpiConnectedBanks: 'Connected Banks',
  kpiConnectedBanksTip: 'Number of banks connected to the UDPN network.',
  kpiConnectedBanksHelp: '{active} of {total} banks connected',
  kpiTokenPairs: 'Token Pairs',
  kpiTokenPairsTip: 'Trading pairs configured for your bank: enabled vs total.',
  kpiTokenPairsHelp: '{enabled} of {total} pairs enabled',
  trend: 'Transaction Trends',
  chartNoData: 'No transaction data for this period.',
  captionTrend: 'Daily transaction statistics',
  thDate: 'Date',
  metricCount: 'Transactions',
  metricAmount: 'Amount',
  metricPair: 'Token Pair',
  sourceAmount: 'Source principal total',
  targetAmount: 'Target principal total',
  amountAggregateNote: 'Period totals · not a daily trend',
  range7d: '7 days',
  range14d: '14 days',
  range30d: '30 days',
  seriesTransactions: 'Transactions',
  unknownPair: 'Unknown pair',
} as const;

type TrendRange = '7D' | '14D' | '30D';
type TrendMetric = 'count' | 'amount' | 'pair';

const TREND_RANGES: ReadonlyArray<{ value: TrendRange; label: string }> = [
  { value: '7D', label: LBL.range7d },
  { value: '14D', label: LBL.range14d },
  { value: '30D', label: LBL.range30d },
];
const TREND_METRICS: ReadonlyArray<{ value: TrendMetric; label: string }> = [
  { value: 'count', label: LBL.metricCount },
  { value: 'amount', label: LBL.metricAmount },
  { value: 'pair', label: LBL.metricPair },
];
const PAIR_COLORS = ['#4f46e5', '#0f766e', '#d97706', '#db2777', '#0284c7'];

function trendRequest(range: TrendRange) {
  if (range !== '14D') return { period: range };

  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - 13);
  return { period: 'CUSTOM', from: from.getTime(), to: now.getTime() };
}

// STATIC-FILLER(GAP-GW-03): Connected Banks 无银行连接统计端点
// （connected/total 口径需后端确认）；以 0 占位，不虚构。
const CONNECTED_BANKS_FALLBACK = { active: 0, total: 0 };



/* ================================================================== */
/* 常量与渲染辅助                                                        */
/* ================================================================== */

/** Transactions (24h) KPI 的滚动窗口（挂载时锚定一次，Refresh 走 refetch）。 */
const TX24H_WINDOW_MS = 24 * 3_600_000;
/** 启用态码（/token/list、/fx/view 语义：20 启用 / 50 停用）。 */
const STATUS_ENABLED = 20;


/** KPI 顶部色条语义色。 */
const BAR_TONE: Record<ProtoStatusTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  info: 'bg-info',
  primary: 'bg-primary',
  muted: 'bg-muted-foreground/40',
};


/** LBL 模板插值：'{active} of {total}' + {active: 3} → '3 of 5'（原型 t() 同构）。 */
function tpl(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
}

/** 计数千分位（原型 num()；非法/空 → 0）。 */
const countFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
function num(v: number | null | undefined): string {
  return countFmt.format(Number.isFinite(Number(v)) ? Number(v) : 0);
}
const amountFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const shortDayFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
function shortDayLabel(isoDay: string): string {
  const d = new Date(`${isoDay}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? isoDay : shortDayFmt.format(d);
}

/** recharts Tooltip 面板主题化（沿用本仓图表写法：变量边框 + 卡片底）。 */
const CHART_TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: '12px',
  color: 'hsl(var(--card-foreground))',
} as const;

/* ================================================================== */
/* KPI 卡（原型 StatCard：顶部色条 + label/ⓘ + 大数值 + 底部 help 脚注） */
/* ================================================================== */

/** ⓘ 口径提示（label 尾随小图标 + Tooltip）。 */
function InfoHint({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`${LBL.title} info`}
            className="rounded p-0.5 text-muted-foreground/70 transition-colors hover:text-foreground"
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function KpiCard({
  tone,
  label,
  tip,
  value,
  footer,
}: {
  tone: ProtoStatusTone;
  label: string;
  tip: string;
  value: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Card className="relative flex min-w-0 flex-col overflow-hidden">
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-0.5 ${BAR_TONE[tone]}`}
      />
      <CardContent className="panel-pad flex flex-1 flex-col gap-2.5">
        <span className="t-supporting flex min-w-0 items-center gap-1 font-semibold tracking-wide text-muted-foreground">
          {label}
          <InfoHint text={tip} />
        </span>
        <div className="min-w-0 text-2xl font-bold leading-none tracking-tight tabular-nums">
          {value}
        </div>
        {footer ? (
          <div className="mt-auto border-t pt-2.5 text-xs text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** KPI 数值：未就绪/失败降级 '-'（页级骨架期不渲染整卡）。 */
function kpiValue(
  ready: boolean,
  compute: () => number | undefined,
): React.ReactNode {
  return ready ? num(compute()) : <span className="text-muted-foreground/60">-</span>;
}

/* ================================================================== */
/* 页面                                                                 */
/* ================================================================== */

export function OverviewListPage() {

  const [trendRange, setTrendRange] = React.useState<TrendRange>('7D');
  const [trendMetric, setTrendMetric] = React.useState<TrendMetric>('count');
  const trendStatsReq = React.useMemo(() => trendRequest(trendRange), [trendRange]);
  const trendStatsQuery = useOverviewStatsQuery(trendStatsReq);
  // Transactions (24h)：CUSTOM 滚动窗口。useMemo 空依赖锚定一次（queryKey 含
  // params 对象，每次渲染新引用会重新拉取；Refresh 走 refetch 不换 key）。
  const tx24hReq = React.useMemo(() => {
    const to = Date.now();
    return { period: 'CUSTOM' as const, from: to - TX24H_WINDOW_MS, to };
  }, []);
  const tx24hQuery = useOverviewStatsQuery(tx24hReq);
  const tokenListQuery = useTokenListQuery();
  const fxViewQuery = useFxViewQuery();

  const queries = [trendStatsQuery, tx24hQuery, tokenListQuery, fxViewQuery];

  /** 健康点：任一查询失败且无数据 → 异常；全部成功 → 正常；初载未知不显。 */
  const anyFailed = queries.some((q) => q.isError && q.data == null);
  const allReady = queries.every((q) => q.isSuccess);
  const systemOk = anyFailed ? false : allReady ? true : null;

  const anyFetching = queries.some((q) => q.isFetching);

  /** As of = 页级查询最新 dataUpdatedAt（无数据 → 0 不显）。 */
  const asOf = Math.max(...queries.map((q) => q.dataUpdatedAt));

  function refetchAll() {
    for (const q of queries) void q.refetch();
  }

  /* —— KPI 真算（各查询独立降级 '-'） —— */

  const tokenList = tokenListQuery.data;
  const activeTokenCount = tokenList
    ? tokenList.filter((t) => t.status === STATUS_ENABLED).length
    : undefined;
  const tokenTotal = tokenList?.length;

  const tx24h = tx24hQuery.data;
  const pairs = fxViewQuery.data?.pairs;
  const enabledPairs = pairs
    ? pairs.filter((p) => p.tokenPair.status === STATUS_ENABLED).length
    : undefined;

  const volumeSeries = trendStatsQuery.data?.volumeSeries ?? [];
  const pairNames = new Map(
    (pairs ?? []).map((item) => [
      item.tokenPair.pairCode ?? '',
      `${item.tokenPair.sourceTokenSymbol ?? item.tokenPair.sourceTokenCode} → ${item.tokenPair.targetTokenSymbol ?? item.tokenPair.targetTokenCode}`,
    ]),
  );
  const pairSeries = React.useMemo(() => {
    const totals = new Map<string, number>();
    for (const day of volumeSeries) {
      for (const [code, value] of Object.entries(day.byPair ?? {})) {
        totals.set(code, (totals.get(code) ?? 0) + (Number(value) || 0));
      }
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, PAIR_COLORS.length)
      .map(([code], index) => ({
        code,
        dataKey: `pair${index}`,
        label: pairNames.get(code) || (code === 'UNKNOWN' ? LBL.unknownPair : code),
        color: PAIR_COLORS[index],
      }));
  }, [volumeSeries, pairs]);
  const trendRows = React.useMemo(
    () =>
      volumeSeries.map((day) => {
        const row: Record<string, string | number> = {
          label: shortDayLabel(day.date),
          transactions: Object.values(day.bySymbol ?? {}).reduce(
            (sum, value) => sum + (Number(value) || 0),
            0,
          ),
        };
        for (const pair of pairSeries) {
          row[pair.dataKey] = Number(day.byPair?.[pair.code]) || 0;
        }
        return row;
      }),
    [volumeSeries, pairSeries],
  );




  /* —— 页级降级：7D 统计不可用即整页 ErrorBlock（其余查询 KPI 内降级） —— */


  if (trendStatsQuery.isError && trendStatsQuery.data == null) {
    return (
      <div className="section-gap flex flex-col">
        <PageHead variant="banner" title={LBL.title} />
        <ErrorBlock
          message="Failed to load overview stats"
          onRetry={refetchAll}
        />
      </div>
    );
  }

  if (trendStatsQuery.isLoading) {
    return (
      <div className="section-gap flex flex-col">
        <PageHead variant="banner" title={LBL.title} />
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="section-gap flex flex-col">
        {/* ① 页头：健康点 + As of + Refresh */}
        <PageHead variant="banner" title={LBL.title}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {systemOk !== null ? (
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-medium ${
                  systemOk ? 'text-success' : 'text-warning'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`size-1.5 rounded-full ${systemOk ? 'bg-success' : 'bg-warning'}`}
                />
                {systemOk ? LBL.systemOk : LBL.systemIssue}
              </span>
            ) : null}
            {asOf > 0 ? (
              <span className="t-supporting whitespace-nowrap tabular-nums text-muted-foreground">
                {`${LBL.asOf} ${formatUtc8(asOf)}`}
              </span>
            ) : null}
            <Button size="sm" variant="outline" onClick={refetchAll} disabled={anyFetching}>
              <RefreshCw
                className={`h-3.5 w-3.5 ${anyFetching ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {LBL.refresh}
            </Button>
          </div>
        </PageHead>

        {/* ② Business Snapshot：4 KPI */}
        <section aria-label={LBL.snapshot} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            tone="primary"
            label={LBL.kpiActiveTokens}
            tip={LBL.kpiActiveTokensTip}
            value={kpiValue(activeTokenCount != null, () => activeTokenCount)}
            footer={
              tokenTotal != null
                ? tpl(LBL.kpiActiveTokensHelp, {
                    active: num(activeTokenCount),
                    total: num(tokenTotal),
                  })
                : undefined
            }
          />
          <KpiCard
            tone="info"
            label={LBL.kpiTx24h}
            tip={LBL.kpiTx24hTip}
            value={kpiValue(tx24h != null, () => tx24h?.totalCount)}
            footer={
              tx24h != null
                ? tpl(LBL.kpiTx24hHelp, {
                    completed: num(tx24h.completedCount),
                    failed: num(tx24h.failedCount),
                  })
                : undefined
            }
          />
          <KpiCard
            tone="success"
            label={LBL.kpiConnectedBanks}
            tip={LBL.kpiConnectedBanksTip}
            // STATIC-FILLER(GAP-GW-03): 无银行连接统计端点，静态 0 占位。
            value={num(CONNECTED_BANKS_FALLBACK.active)}
            footer={tpl(LBL.kpiConnectedBanksHelp, CONNECTED_BANKS_FALLBACK)}
          />
          <KpiCard
            tone="primary"
            label={LBL.kpiTokenPairs}
            tip={LBL.kpiTokenPairsTip}
            value={kpiValue(enabledPairs != null, () => enabledPairs)}
            footer={
              pairs != null
                ? tpl(LBL.kpiTokenPairsHelp, {
                    enabled: num(enabledPairs),
                    total: num(pairs.length),
                  })
                : undefined
            }
          />
        </section>

        {/* Transaction trends */}
        <section className="min-w-0">
          <Card className="min-w-0 overflow-hidden">
            <CardContent className="panel-pad">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold leading-6 text-foreground">
                    {LBL.trend}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {trendMetric === 'amount'
                      ? LBL.amountAggregateNote
                      : trendMetric === 'pair'
                        ? 'Daily transaction count by token pair'
                        : 'Daily transaction count'}
                  </p>
                </div>
                <div
                  role="group"
                  aria-label="Trend period"
                  className="inline-flex rounded-lg border p-1"
                >
                  {TREND_RANGES.map((range) => (
                    <button
                      key={range.value}
                      type="button"
                      aria-pressed={trendRange === range.value}
                      onClick={() => setTrendRange(range.value)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        trendRange === range.value
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>

              <div
                role="tablist"
                aria-label="Transaction metric"
                className="mt-5 flex w-full max-w-[37rem] items-center gap-1.5 rounded-xl border border-border bg-muted/50 p-1.5"
              >
                {TREND_METRICS.map((metric) => (
                  <button
                    key={metric.value}
                    type="button"
                    role="tab"
                    aria-selected={trendMetric === metric.value}
                    onClick={() => setTrendMetric(metric.value)}
                    className={`flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                      trendMetric === metric.value
                        ? 'bg-primary/10 text-primary shadow-sm'
                        : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'
                    }`}
                  >
                    {metric.label}
                  </button>
                ))}
              </div>

              {trendMetric === 'amount' ? (
                <div className="grid gap-3 py-6 sm:grid-cols-2">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">{LBL.sourceAmount}</p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums">
                      {amountFmt.format(Number(trendStatsQuery.data?.sourcePrincipalSum) || 0)}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">{LBL.targetAmount}</p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums">
                      {amountFmt.format(Number(trendStatsQuery.data?.targetPrincipalSum) || 0)}
                    </p>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-2">
                    The API returns source/target totals only, without token-denomination
                    breakdown or daily amount series; these figures are not a daily
                    trend.
                  </p>
                </div>
              ) : trendRows.length === 0 ? (
                <div className="py-12">
                  <EmptyHint text={LBL.chartNoData} />
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-x-5 gap-y-2 py-4">
                    {trendMetric === 'count' ? (
                      <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <span
                          aria-hidden="true"
                          className="size-2 rounded-full"
                          style={{ background: 'hsl(var(--primary))' }}
                        />
                        {LBL.seriesTransactions}
                      </span>
                    ) : (
                      pairSeries.map((pair) => (
                        <span
                          key={pair.code}
                          className="inline-flex items-center gap-2 text-xs text-muted-foreground"
                        >
                          <span
                            aria-hidden="true"
                            className="size-2 rounded-full"
                            style={{ background: pair.color }}
                          />
                          {pair.label}
                        </span>
                      ))
                    )}
                  </div>
                  <div aria-hidden="true" className="h-72 min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={trendRows}
                        margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                      >
                        <CartesianGrid
                          vertical={false}
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                        />
                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          allowDecimals={false}
                          width={44}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <ChartTooltip contentStyle={CHART_TOOLTIP_STYLE} />
                        {trendMetric === 'count' ? (
                          <Line
                            type="monotone"
                            dataKey="transactions"
                            name={LBL.seriesTransactions}
                            stroke="hsl(var(--primary))"
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{ r: 4 }}
                            isAnimationActive={false}
                          />
                        ) : (
                          pairSeries.map((pair) => (
                            <Line
                              key={pair.code}
                              type="monotone"
                              dataKey={pair.dataKey}
                              name={pair.label}
                              stroke={pair.color}
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 3 }}
                              isAnimationActive={false}
                            />
                          ))
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="sr-only">
                    <table>
                      <caption>{LBL.captionTrend}</caption>
                      <thead>
                        <tr>
                          <th scope="col">{LBL.thDate}</th>
                          {trendMetric === 'count' ? (
                            <th scope="col">{LBL.seriesTransactions}</th>
                          ) : (
                            pairSeries.map((pair) => (
                              <th key={pair.code} scope="col">{pair.label}</th>
                            ))
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {trendRows.map((row, index) => (
                          <tr key={volumeSeries[index].date}>
                            <th scope="row">{volumeSeries[index].date}</th>
                            {trendMetric === 'count' ? (
                              <td>{num(Number(row.transactions))}</td>
                            ) : (
                              pairSeries.map((pair) => (
                                <td key={pair.code}>{num(Number(row[pair.dataKey]))}</td>
                              ))
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </section>

      </div>
    </TooltipProvider>
  );
}
