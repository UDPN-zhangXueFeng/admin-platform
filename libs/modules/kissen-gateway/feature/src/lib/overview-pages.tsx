'use client';

/**
 * Dashboard（BP 原型 DashboardPage 对齐改造，GAP-GW-03 + plan/12 §5）。
 *
 * 原型 2026-09-21 改版后的四段结构：
 *   ① 页头：健康点（All systems normal / System issues detected）+ As of + Refresh
 *   ② Business Snapshot：4 KPI 卡（顶部色条 + label/ⓘ 口径提示 + 大数值 + help 脚注）
 *   ③ 7-Day Operations 逐日 5 状态堆叠柱 + 7-Day Trend 双折线（各带 sr-only 数据表）
 *   ④ Recent Transactions：/tx/page 第 1 页 8 条（列样式对齐交易列表页）+ View All
 *
 * KPI/图表数据源裁定（GAP-GW-03：可换算的真数据优先，缺口静态补齐 + 打标）：
 * - Active Tokens = /token/list 真算（status=20 计 active）
 * - Transactions (24h) = /overview CUSTOM 滚动 24h 窗口真算（total/completed/failed）
 * - Active Portal Users = 静态补齐（无门户用户聚合统计端点，不虚构）
 * - Token Pairs = /fx/view 真算（tokenPair.status=20 计 enabled）
 * - Trend Transactions 瘤 = /overview 7D volumeSeries 逐日求和真算（任一维度求和
 *   = 当日交易总数，后端已连续补 0）；Completed 逐日线与 Operations 5 状态组
 *   无逐日 × 状态端点，静态补齐（见下方 STATIC-FILLER 块）
 * 原型早版的 period 切换 / CUSTOM 日期段 / 币种切换 / 页尾统计口径脚注已随原型
 * 改版删除，不回加。图表用 recharts（既有依赖；禁 echarts/Tremor）。
 */

import * as React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, Inbox, Info, RefreshCw } from 'lucide-react';

import {
  Alert,
  AlertTitle,
  Button,
  Card,
  CardContent,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@myorg/shared/ui';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  useFxViewQuery,
  useOverviewStatsQuery,
  useTokenListQuery,
  useTxPage,
  type FxPairItem,
} from '@myorg/modules/kissen-gateway/data-access';

import { formatTokenAmount, formatUtc8 } from './proto-format';
import { protoStatusText, PROTO_TX_STATUS } from './proto-enums';
import {
  CopyableId,
  Dash,
  ProtoStatusBadge,
  type ProtoStatusTone,
} from './proto-ui';
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
  kpiPortalUsers: 'Active Portal Users',
  kpiPortalUsersTip: 'Portal accounts of your bank: enabled vs total.',
  kpiPortalUsersHelp: '{active} of {total} accounts enabled',
  kpiTokenPairs: 'Token Pairs',
  kpiTokenPairsTip: 'Trading pairs configured for your bank: enabled vs total.',
  kpiTokenPairsHelp: '{enabled} of {total} pairs enabled',
  operations: '7-Day Operations',
  trend: '7-Day Trend',
  seriesCompleted: 'Completed',
  seriesProcessing: 'Processing',
  seriesReversed: 'Reversed',
  seriesException: 'Exception',
  seriesFailed: 'Failed',
  seriesTransactions: 'Transactions',
  chartNoData: 'No transaction data for this period.',
  chartNoVolume: 'No volume in this period.',
  captionOperations: 'Daily transaction volume by status',
  captionTrend: 'Daily transaction count',
  thDate: 'Date',
  recent: 'Recent Transactions',
  viewAll: 'View All',
  thTxNo: 'Transaction No.',
  thTokens: 'Tokens',
  thAmount: 'Amount',
  thCreated: 'Created on',
  thStatus: 'Status',
  thActions: 'Actions',
  details: 'Details',
  emptyTitle: 'No transactions found.',
  emptyDesc: 'Transactions involving this token will appear here.',
} as const;

/* ================================================================== */
/* 静态补齐（GAP-GW-03：/overview 无逐日 × 状态分组、无门户用户统计；    */
/* 缺口与补齐语义见 .doc/kissen/kissen-bug/2026-09-23-原型对齐-API缺口与静态补齐记录.md）*/
/* ================================================================== */

// STATIC-FILLER(GAP-GW-03): Active Portal Users 无门户用户聚合统计端点
// （enabled/total 口径需后端确认）；以 0 占位，不虚构。
const PORTAL_USERS_FALLBACK = { active: 0, total: 0 };

// STATIC-FILLER(GAP-GW-03): 7-Day Operations 逐日 × 5 状态组交易数无端点
// （/overview 仅逐日总量 volumeSeries + 窗口内状态合计 statusDistribution，
// 无法透视逐日 × 状态）；恒 0 占位不虚构 → hasVolume=false，展示原型空态
// 横幅 "No volume in this period."。日期轴仍用 volumeSeries 真日期。
const OPERATIONS_ZERO = {
  completed: 0,
  inProgress: 0,
  reversed: 0,
  exception: 0,
  failed: 0,
};

// STATIC-FILLER(GAP-GW-03): 7-Day Trend 的 Completed 逐日完成数无端点
// （volumeSeries 不分状态）；恒 0 占位，Transactions 线为真数据。
const TREND_COMPLETED_FALLBACK = 0;

/* ================================================================== */
/* 常量与渲染辅助                                                        */
/* ================================================================== */

/** Recent Transactions 首页条数（原型 pageSize）。 */
const RECENT_TX_PAGE_SIZE = 8;
/** Transactions (24h) KPI 的滚动窗口（挂载时锚定一次，Refresh 走 refetch）。 */
const TX24H_WINDOW_MS = 24 * 3_600_000;
/** 启用态码（/token/list、/fx/view 语义：20 启用 / 50 停用）。 */
const STATUS_ENABLED = 20;

/** 堆叠柱 5 状态组（label 原型逐字；色板 = 主题语义色 CSS 变量）。 */
const OPERATIONS_SERIES = [
  { key: 'completed', label: LBL.seriesCompleted, color: 'hsl(var(--success))' },
  { key: 'inProgress', label: LBL.seriesProcessing, color: 'hsl(var(--primary))' },
  { key: 'reversed', label: LBL.seriesReversed, color: 'hsl(var(--info))' },
  { key: 'exception', label: LBL.seriesException, color: 'hsl(var(--warning))' },
  { key: 'failed', label: LBL.seriesFailed, color: 'hsl(var(--destructive))' },
] as const;

/** KPI 顶部色条语义色。 */
const BAR_TONE: Record<ProtoStatusTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  info: 'bg-info',
  primary: 'bg-primary',
  muted: 'bg-muted-foreground/40',
};

/** 交易状态 → 徽章语义色（13 态同码表，与交易列表页一致）。 */
const TX_TONE: Record<number, ProtoStatusTone> = {
  1: 'muted',
  5: 'muted',
  10: 'info',
  20: 'info',
  25: 'info',
  30: 'info',
  35: 'success',
  40: 'success',
  50: 'warning',
  60: 'danger',
  70: 'danger',
  80: 'danger',
  90: 'danger',
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
  const router = useRouter();

  // 7D 窗口：Trend Transactions 线 + Operations 日期轴（真数据源）。
  const stats7dQuery = useOverviewStatsQuery({ period: '7D' });
  // Transactions (24h)：CUSTOM 滚动窗口。useMemo 空依赖锚定一次（queryKey 含
  // params 对象，每次渲染新引用会重新拉取；Refresh 走 refetch 不换 key）。
  const tx24hReq = React.useMemo(() => {
    const to = Date.now();
    return { period: 'CUSTOM' as const, from: to - TX24H_WINDOW_MS, to };
  }, []);
  const tx24hQuery = useOverviewStatsQuery(tx24hReq);
  const tokenListQuery = useTokenListQuery();
  const fxViewQuery = useFxViewQuery();
  const recentTxQuery = useTxPage({ pageNum: 1, pageSize: RECENT_TX_PAGE_SIZE });

  const queries = [stats7dQuery, tx24hQuery, tokenListQuery, fxViewQuery, recentTxQuery];

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

  /* —— 图表数据（日期轴与 Transactions 线真算；状态组/Completed 静态补齐） —— */

  const volumeSeries = stats7dQuery.data?.volumeSeries ?? [];

  const operationsRows = React.useMemo(
    () =>
      volumeSeries.map((p) => ({
        label: shortDayLabel(p.date),
        // STATIC-FILLER(GAP-GW-03): 逐日 5 状态组恒 0 占位（见文件头）。
        ...OPERATIONS_ZERO,
      })),
    // deps: volumeSeries 派生自 stats7dQuery.data
    [stats7dQuery.data],
  );

  const trendRows = React.useMemo(
    () =>
      volumeSeries.map((p) => {
        let transactions = 0;
        for (const v of Object.values(p.bySymbol ?? {})) {
          transactions += Number(v) || 0;
        }
        return {
          label: shortDayLabel(p.date),
          transactions,
          completed: TREND_COMPLETED_FALLBACK,
        };
      }),
    // deps: volumeSeries 派生自 stats7dQuery.data
    [stats7dQuery.data],
  );

  const hasVolume = operationsRows.some((r) =>
    (Object.keys(OPERATIONS_ZERO) as Array<keyof typeof OPERATIONS_ZERO>).some(
      (k) => r[k] > 0,
    ),
  );

  /* —— Recent Transactions：/tx/page 第 1 页 + /fx/view pairMap（tokens 列口径） —— */

  const recentRows = recentTxQuery.data?.data ?? [];
  const pairMap = React.useMemo(() => {
    const m = new Map<number, FxPairItem>();
    for (const p of fxViewQuery.data?.pairs ?? []) m.set(p.tokenPair.pairId, p);
    return m;
  }, [fxViewQuery.data]);

  /* —— 页级降级：7D 统计不可用即整页 ErrorBlock（其余查询 KPI 内降级） —— */


  if (stats7dQuery.isError && stats7dQuery.data == null) {
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

  if (stats7dQuery.isLoading) {
    return (
      <div className="section-gap flex flex-col">
        <PageHead variant="banner" title={LBL.title} />
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
        <Skeleton className="h-64" />
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
            label={LBL.kpiPortalUsers}
            tip={LBL.kpiPortalUsersTip}
            // STATIC-FILLER(GAP-GW-03): 无门户用户统计端点，静态 0 占位。
            value={num(PORTAL_USERS_FALLBACK.active)}
            footer={tpl(LBL.kpiPortalUsersHelp, PORTAL_USERS_FALLBACK)}
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

        {/* ③ 7-Day Operations 堆叠柱 + 7-Day Trend 折线 */}
        <section className="grid min-w-0 gap-3 lg:grid-cols-2">
          <Card className="min-w-0 overflow-hidden">
            <CardContent className="panel-pad">
              <h3 className="mb-3 text-base font-semibold leading-6 text-foreground">
                {LBL.operations}
              </h3>
              <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                {OPERATIONS_SERIES.map((s) => (
                  <span
                    key={s.key}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <span
                      aria-hidden="true"
                      className="inline-block size-2 rounded-full"
                      style={{ background: s.color }}
                    />
                    {s.label}
                  </span>
                ))}
              </div>
              {operationsRows.length === 0 ? (
                <EmptyHint text={LBL.chartNoData} />
              ) : (
                <>
                  <div aria-hidden="true" className="h-72 min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={operationsRows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
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
                        <ChartTooltip
                          cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.35 }}
                          contentStyle={CHART_TOOLTIP_STYLE}
                        />
                        {OPERATIONS_SERIES.map((s) => (
                          <Bar
                            key={s.key}
                            dataKey={s.key}
                            name={s.label}
                            stackId="ops"
                            fill={s.color}
                            isAnimationActive={false}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {!hasVolume ? (
                    <Alert variant="default" className="mt-3 border-info/30 bg-info/5 text-info">
                      <Info className="h-4 w-4" aria-hidden="true" />
                      <AlertTitle>{LBL.chartNoVolume}</AlertTitle>
                    </Alert>
                  ) : null}
                  <div className="sr-only">
                    <table>
                      <caption>{LBL.captionOperations}</caption>
                      <thead>
                        <tr>
                          <th scope="col">{LBL.thDate}</th>
                          {OPERATIONS_SERIES.map((s) => (
                            <th key={s.key} scope="col">
                              {s.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {volumeSeries.map((p, i) => (
                          <tr key={p.date}>
                            <th scope="row">{p.date}</th>
                            {OPERATIONS_SERIES.map((s) => (
                              <td key={s.key}>{num(operationsRows[i][s.key])}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden">
            <CardContent className="panel-pad">
              <h3 className="mb-3 text-base font-semibold leading-6 text-foreground">
                {LBL.trend}
              </h3>
              <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    aria-hidden="true"
                    className="inline-block size-2 rounded-full"
                    style={{ background: 'hsl(var(--primary))' }}
                  />
                  {LBL.seriesTransactions}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    aria-hidden="true"
                    className="inline-block size-2 rounded-full"
                    style={{ background: 'hsl(var(--success))' }}
                  />
                  {LBL.seriesCompleted}
                </span>
              </div>
              {trendRows.length === 0 ? (
                <EmptyHint text={LBL.chartNoData} />
              ) : (
                <>
                  <div aria-hidden="true" className="h-72 min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendRows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
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
                        <Line
                          type="monotone"
                          dataKey="transactions"
                          name={LBL.seriesTransactions}
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 3 }}
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="completed"
                          name={LBL.seriesCompleted}
                          stroke="hsl(var(--success))"
                          strokeWidth={2}
                          strokeDasharray="4 3"
                          dot={false}
                          activeDot={{ r: 3 }}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="sr-only">
                    <table>
                      <caption>{LBL.captionTrend}</caption>
                      <thead>
                        <tr>
                          <th scope="col">{LBL.thDate}</th>
                          <th scope="col">{LBL.seriesTransactions}</th>
                          <th scope="col">{LBL.seriesCompleted}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trendRows.map((r, i) => (
                          <tr key={volumeSeries[i].date}>
                            <th scope="row">{volumeSeries[i].date}</th>
                            <td>{num(r.transactions)}</td>
                            <td>{num(r.completed)}</td>
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

        {/* ④ Recent Transactions */}
        <section className="rounded-lg border border-border/60 bg-card">
          <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <h3 className="text-base font-semibold leading-6 text-foreground">{LBL.recent}</h3>
            <Button
              variant="ghost"
              size="sm"
              className="-mr-2 gap-1.5 text-primary hover:text-primary"
              onClick={() => router.push('/tx')}
            >
              {LBL.viewAll}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] caption-bottom text-sm">
              <thead className="bg-muted/50 text-left">
                <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="whitespace-nowrap px-4 py-2.5 font-medium sm:px-5">{LBL.thTxNo}</th>
                  <th scope="col" className="whitespace-nowrap px-4 py-2.5 font-medium">{LBL.thTokens}</th>
                  <th scope="col" className="whitespace-nowrap px-4 py-2.5 font-medium">{LBL.thAmount}</th>
                  <th scope="col" className="whitespace-nowrap px-4 py-2.5 font-medium">{LBL.thCreated}</th>
                  <th scope="col" className="whitespace-nowrap px-4 py-2.5 font-medium">{LBL.thStatus}</th>
                  <th scope="col" className="whitespace-nowrap px-4 py-2.5 text-right font-medium sm:px-5">{LBL.thActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {recentRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 sm:px-5">
                      <div className="flex flex-col items-center justify-center gap-1.5 text-center">
                        <Inbox className="h-9 w-9 text-muted-foreground/40" strokeWidth={1.5} aria-hidden="true" />
                        <p className="text-sm font-medium">{LBL.emptyTitle}</p>
                        <p className="text-sm text-muted-foreground">{LBL.emptyDesc}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  recentRows.map((row) => {
                    const pair = row.pairId != null ? pairMap.get(row.pairId) : undefined;
                    const tp = pair?.tokenPair;
                    const symbols = tp
                      ? `${tp.sourceTokenSymbol ?? tp.sourceTokenCode} → ${tp.targetTokenSymbol ?? tp.targetTokenCode}`
                      : row.pairId != null
                        ? `#${row.pairId}`
                        : undefined;
                    const banks = tp
                      ? `${tp.sourceBankCode ?? '-'} - ${tp.targetBankCode ?? '-'}`
                      : undefined;
                    return (
                      <tr key={row.transactionId} className="transition-colors hover:bg-muted/30">
                        <td className="whitespace-nowrap px-4 py-3 sm:px-5">
                          <CopyableId
                            value={row.txNo || row.txUuid || String(row.transactionId)}
                            className="font-mono"
                          />
                        </td>
                        <td className="px-4 py-3">
                          {symbols ? (
                            <div className="min-w-0">
                              <div className="font-semibold">{symbols}</div>
                              {banks ? (
                                <div className="text-xs text-muted-foreground">{banks}</div>
                              ) : null}
                            </div>
                          ) : (
                            <Dash />
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {row.userDeduction != null || row.receiverAmount != null ? (
                            <span className="inline-flex flex-wrap items-center gap-1">
                              {row.userDeduction != null ? (
                                <>
                                  <span className="font-semibold tabular-nums">
                                    {formatTokenAmount(row.userDeduction)}
                                  </span>
                                  {tp?.sourceTokenSymbol ? (
                                    <span className="font-medium text-muted-foreground">
                                      {tp.sourceTokenSymbol}
                                    </span>
                                  ) : null}
                                </>
                              ) : (
                                <Dash />
                              )}
                              <span aria-hidden="true" className="text-muted-foreground/60">→</span>
                              {row.receiverAmount != null ? (
                                <>
                                  <span className="font-semibold tabular-nums">
                                    {formatTokenAmount(row.receiverAmount)}
                                  </span>
                                  {tp?.targetTokenSymbol ? (
                                    <span className="font-medium text-muted-foreground">
                                      {tp.targetTokenSymbol}
                                    </span>
                                  ) : null}
                                </>
                              ) : (
                                <Dash />
                              )}
                            </span>
                          ) : (
                            <Dash />
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground tabular-nums">
                          {row.createTime != null ? formatUtc8(row.createTime) : <Dash />}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <ProtoStatusBadge
                            label={protoStatusText(PROTO_TX_STATUS, row.status)}
                            tone={TX_TONE[row.status ?? 0] ?? 'muted'}
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right sm:px-5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              router.push(`/tx/detail?id=${row.transactionId}`)
                            }
                          >
                            {LBL.details}
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </TooltipProvider>
  );
}
