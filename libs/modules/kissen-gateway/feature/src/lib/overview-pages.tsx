'use client';

import * as React from 'react';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Badge, Skeleton } from '@myorg/shared/ui';

import {
  OVERVIEW_PERIOD_DEFAULT,
  OVERVIEW_PERIOD_OPTIONS,
  TOKEN_STATUS,
  useFxViewQuery,
  useOverviewStatsQuery,
  type OverviewPeriod,
  type VolumeDayPoint,
} from '@myorg/modules/kissen-gateway/data-access';

import { formatTime } from './kit';
import { PageHead } from './page-head';
import { ErrorBlock, EmptyHint } from './state-blocks';

/**
 * 统计概览页（源 `views/overview/index.vue`：metrics 卡 + 业务概览（整宽）+
 * 交易量统计折线图，period 四档切换默认 7D；39c8a2b UDPN 改版删除了
 * 交易口径/状态分布/最近交易三卡，API 字段仍在仅 UI 移除）。
 * 路由 /overview（registry：overview → list）。
 *
 * - 服务端状态 TanStack Query（period/from/to 即 query key 维度）。
 * - 接口失败 fail-loud：ErrorBlock + Retry（源 catch 仅靠拦截器，目标
 *   约束升级为页面内可感知可恢复）。
 * - TOKEN 状态映射复用 data-access 既有 TOKEN_STATUS（码值 5/20/15/50），
 *   Badge variant 分层与 token 页一致，页面不硬编码码值。
 * - 折线图 echarts → recharts（工作区既有依赖；约束禁 echarts）：
 *   逐日 date 轴、y 轴整数刻度（源 minInterval=1）、序列按窗口总量降序、
 *   UNKNOWN 键 legend 显示 Unsynced；轴/网格/tooltip 用主题 CSS 变量。
 */

/* ================================================================== */
/* period 切换（源 el-radio-group + el-date-picker daterange）          */
/* ================================================================== */

/** 源切换 period 非 CUSTOM 时清空 range 再拉取（onPeriodChange）。 */
function onPeriodSelect(
  next: string,
  period: OverviewPeriod,
  setPeriod: (p: OverviewPeriod) => void,
  setRange: (r: [string, string] | null) => void,
): void {
  const value = next as OverviewPeriod;
  setPeriod(value);
  if (value !== 'CUSTOM') setRange(null);
}

/**
 * CUSTOM 日界字符串（YYYY-MM-DD）→ 本地零点毫秒。源 daterange
 * value-format="x" 按浏览器本地零点取整；kit.toEpochMs 走 new Date(value)
 * 会把纯日期串按 UTC 零点解析，差一个时区偏移——拼 'T00:00:00' 后按本地解析对齐。
 */
function dayRangeToEpochMs(value: string): number | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d.getTime();
}

/* ================================================================== */
/* 业务概览 token 分状态 tags                                           */
/* ================================================================== */

/** token 分状态 tags：count>0 才显示（源 tokenStatusList computed）。 */
function buildTokenStatusList(dist: Record<string, number> | undefined) {
  return Object.entries(dist ?? {})
    .map(([code, count]) => {
      const c = Number(count);
      const meta = TOKEN_STATUS[Number(code)] ?? { text: `Status (${code})`, variant: 'outline' as const };
      return { code: Number(code), count: c, text: meta.text, variant: meta.variant };
    })
    .filter((t) => t.count > 0);
}

/* ================================================================== */
/* 交易量折线（源 dimEntries + chartOption：echarts → recharts）        */
/* ================================================================== */

/** 折线维度切换项（源 el-radio-button 按汇率对/按币种，默认 pair）。 */
const VOLUME_DIM_OPTIONS = [
  { value: 'pair', label: 'By Pair' },
  { value: 'symbol', label: 'By Symbol' },
] as const;

type VolumeDim = 'pair' | 'symbol';

/** 源 UNKNOWN 序列键：legend/名称显示「Unsynced」（未同步）。 */
const UNKNOWN_SERIES_KEY = 'UNKNOWN';

/**
 * 折线系列色板：主题未定义图表序列 token，取 tailwind 调色板 600 档循环
 * （本项目自选，非上游 hex 直写）；轴/网格/tooltip 走主题 CSS 变量。
 */
const SERIES_COLORS = [
  '#2563eb', // blue-600
  '#0d9488', // teal-600
  '#9333ea', // purple-600
  '#ea580c', // orange-600
  '#0e7490', // cyan-700
  '#65a30d', // lime-600
  '#db2777', // pink-600
  '#475569', // slate-600
];

/**
 * 折线数据装配（源 dimEntries + chartOption computed）：
 * - 序列 = 当前维度各 key，按窗口总量降序（legend 顺序即此顺序）；
 * - 行 = 逐日 date + 各序列当日量（缺省 0；后端已连续补 0，这里双保险）；
 * - 列名用 s0/s1… 安全 id（key 可能含 '/' 等字符，直接作 dataKey 会被
 *   recharts 按对象路径解析而取不到值），展示名由 Line name 承担；
 * - pair 维度的展示名优先使用 fx/view 返回的 source/target token symbol，
 *   查询未命中时回退 pairCode；所有序列总量为 0/无数据 → empty（整卡
 *   EmptyHint，不渲染图表）。
 */
function buildVolumeChart(
  points: VolumeDayPoint[] | undefined,
  dim: VolumeDim,
  pairLabels?: Map<string, string>,
) {
  const totals: Record<string, number> = {};
  for (const p of points ?? []) {
    const map = dim === 'pair' ? p.byPair : p.bySymbol;
    for (const [k, v] of Object.entries(map)) totals[k] = (totals[k] ?? 0) + Number(v);
  }
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const rows = (points ?? []).map((p) => {
    const map = dim === 'pair' ? p.byPair : p.bySymbol;
    const row: Record<string, number | string> = { date: p.date };
    entries.forEach(([key], i) => {
      row[`s${i}`] = Number(map[key] ?? 0);
    });
    return row;
  });
  return {
    series: entries.map(([key], i) => ({
      key,
      id: `s${i}`,
      label: dim === 'pair' ? pairLabels?.get(key) ?? key : key,
    })),
    rows,
    // 源 volumeEmpty = dimEntries(...).length === 0：有序列键即画图（全零平线），仅无键才空态。
    empty: entries.length === 0,
  };
}

/* ================================================================== */
/* 页面                                                                 */
/* ================================================================== */

export function OverviewListPage() {
  const [period, setPeriod] = React.useState<OverviewPeriod>(OVERVIEW_PERIOD_DEFAULT);
  const [range, setRange] = React.useState<[string, string] | null>(null);
  const [volumeDim, setVolumeDim] = React.useState<VolumeDim>('pair');

  const params = React.useMemo(
    () => ({
      period,
      from: period === 'CUSTOM' && range ? dayRangeToEpochMs(range[0]) : undefined,
      to: period === 'CUSTOM' && range ? dayRangeToEpochMs(range[1]) : undefined,
    }),
    [period, range],
  );

  const { data: stats, isLoading, isError, error, refetch } = useOverviewStatsQuery(params);
  // pair 维度需要 token symbol；复用 FX 聚合查询，切到 By Symbol 时不发请求。
  const { data: fxView } = useFxViewQuery(volumeDim === 'pair');

  // 源 pairSeriesName（d764217）：pairCode → 「source symbol → target symbol」；
  // 映射结果重名的 pair 回退 pairCode（used.has 语义），避免图例撞名串线。
  const pairLabels = React.useMemo(() => {
    const labels = new Map<string, string>();
    const used = new Set<string>();
    for (const pair of fxView?.pairs ?? []) {
      const { tokenPair } = pair;
      if (!tokenPair.pairCode) continue;
      const source = tokenPair.sourceTokenSymbol || tokenPair.sourceTokenCode || '-';
      const target = tokenPair.targetTokenSymbol || tokenPair.targetTokenCode || '-';
      const name = `${source} → ${target}`;
      if (used.has(name)) continue;
      used.add(name);
      labels.set(tokenPair.pairCode, name);
    }
    return labels;
  }, [fxView]);

  const tokenStatusList = React.useMemo(
    () => buildTokenStatusList(stats?.tokenByStatus),
    [stats],
  );
  const volume = React.useMemo(
    () => buildVolumeChart(stats?.volumeSeries, volumeDim, pairLabels),
    [stats, volumeDim, pairLabels],
  );

  return (
    <div className="flex flex-col section-gap">
      <PageHead variant="banner" title="Dashboard">
        <div className="flex flex-wrap items-center gap-2">
          {/* 源 el-radio-group size=small：四档互斥切换，选中即拉取。 */}
          <SegmentedRadioGroup
            ariaLabel="Statistics period"
            options={OVERVIEW_PERIOD_OPTIONS}
            value={period}
            onSelect={(next) => onPeriodSelect(next, period, setPeriod, setRange)}
          />
          {/* 源 el-date-picker daterange value-format="x"：起止日期 → 毫秒。 */}
          {period === 'CUSTOM' && (
            <span className="flex items-center gap-2 text-sm">
              <input
                type="date"
                aria-label="Start date"
                value={range?.[0] ?? ''}
                onChange={(e) =>
                  setRange((prev) => [e.target.value, prev?.[1] ?? ''])
                }
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              />
              <span className="text-muted-foreground">to</span>
              <input
                type="date"
                aria-label="End date"
                value={range?.[1] ?? ''}
                onChange={(e) =>
                  setRange((prev) => [prev?.[0] ?? '', e.target.value])
                }
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              />
            </span>
          )}
        </div>
      </PageHead>

      {isError ? (
        <section className="rounded-lg border border-border/60 bg-card panel-pad text-card-foreground shadow-float">
          <ErrorBlock
            message={error instanceof Error ? error.message : String(error)}
            onRetry={() => refetch()}
          />
        </section>
      ) : isLoading || !stats ? (
        /* 源 v-loading 覆盖指标卡区：首帧骨架。 */
        <section className="rounded-lg border border-border/60 bg-card panel-pad text-card-foreground shadow-float">
          <div className="space-y-3">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-8 w-1/2" />
          </div>
        </section>
      ) : (
        <>
          {/* 交易指标卡（源 metric-grid：auto-fit 七卡） */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
            <MetricCard value={String(stats.totalCount)} label="Total Transactions" tone="" />
            <MetricCard value={String(stats.completedCount)} label="Completed" tone="ok" />
            <MetricCard value={String(stats.failedCount)} label="Failed" tone="bad" />
            <MetricCard value={String(stats.reversedCount)} label="Reversed" tone="" />
            <MetricCard value={String(stats.exceptionCount)} label="Requires Manual Review" tone="bad" />
            <MetricCard value={String(stats.pendingCount)} label="Pending" tone="warn" />
            {/* d764217：成功率色分档 ≥90 ok / 60~90 warn / <60 bad，null 无色。 */}
            <MetricCard
              value={formatSuccessRate(stats.successRate)}
              label="Success Rate"
              tone={successRateTone(stats.successRate)}
            />
          </div>

          {/* 业务概览（源「业务概览」descriptions；39c8a2b UDPN 改版整宽单卡） */}
          <section className="rounded-lg border border-border/60 bg-card panel-pad text-card-foreground shadow-float">
            <div className="mb-4 t-section-title">Business Overview</div>
            <div className="divide-y rounded-md border">
              <DescRow label="Registered Tokens">
                <span>{stats.tokenTotal}</span>
                <span className="ml-2.5 inline-flex flex-wrap gap-1.5">
                  {tokenStatusList.map((t) => (
                    <Badge key={t.code} variant={t.variant}>
                      {t.text} {t.count}
                    </Badge>
                  ))}
                </span>
              </DescRow>
              <DescRow label="Token Pairs">
                <span>{stats.tokenPairCount}</span>
              </DescRow>
              <DescRow label="Reporting Period">
                <span>
                  {formatTime(stats.from)} ~ {formatTime(stats.to)}
                </span>
              </DescRow>
            </div>
          </section>

          {/* 交易量统计（源 volume-head + echarts 折线；空窗口整卡 el-empty） */}
          <section className="rounded-lg border border-border/60 bg-card panel-pad text-card-foreground shadow-float">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="t-section-title">Transaction Volume Statistics</div>
              {/* 源 el-radio-group size=small：pair/symbol 两维度切换（默认 pair）。 */}
              <SegmentedRadioGroup
                ariaLabel="Volume dimension"
                options={VOLUME_DIM_OPTIONS}
                value={volumeDim}
                onSelect={setVolumeDim}
              />
            </div>
            {volume.empty ? (
              <EmptyHint text="No transactions in this window" />
            ) : (
              /* ResponsiveContainer 需父容器固定高：源 .volume-chart 320px → h-80。 */
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={volume.rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid
                      vertical={false}
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="date"
                      minTickGap={24}
                      tickLine={false}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    />
                    {/* 源 yAxis minInterval=1：整数刻度。 */}
                    <YAxis
                      allowDecimals={false}
                      width={44}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip
                      cursor={{ stroke: 'hsl(var(--border))' }}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 6,
                        color: 'hsl(var(--card-foreground))',
                        fontSize: 12,
                      }}
                    />
                    {/* 源 legend bottom + 滚动；recharts 底部换行承载。 */}
                    <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 12 }} />
                    {volume.series.map((s, i) => (
                      <Line
                        key={s.key}
                        dataKey={s.id}
                        name={s.key === UNKNOWN_SERIES_KEY ? 'Unsynced' : s.label}
                        type="monotone"
                        strokeWidth={2}
                        stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                        /* 源 showSymbol：仅窗口点数 ≤31 才画点符号。 */
                        dot={volume.rows.length <= 31}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <p className="text-center t-supporting text-muted-foreground">
            Statistics are based on local instance data only (transaction records / token
            registrations / token pair pushes), not network-wide figures.
          </p>
        </>
      )}
    </div>
  );
}

/* ================================================================== */
/* 子组件                                                               */
/* ================================================================== */

/** 源 successRate：null → '—'；eafcab0 起后端直发百分数值，不再 ×100。 */
function formatSuccessRate(rate: number | null | undefined): string {
  return rate == null ? '—' : `${Number(rate).toFixed(2)}%`;
}

/** d764217 源指标色分档：≥90 ok / 60~90 warn / <60 bad；null → 无色。 */
function successRateTone(
  rate: number | null | undefined,
): 'ok' | 'warn' | 'bad' | '' {
  if (rate == null) return '';
  if (rate >= 90) return 'ok';
  if (rate >= 60) return 'warn';
  return 'bad';
}

const METRIC_TONES: Record<string, string> = {
  ok: 'text-success',
  bad: 'text-destructive',
  warn: 'text-warning',
};

/** 指标卡（源 metric-card：26px mono 数值 + 12px 灰标；tone 为源 ok/bad/warn 色系）。 */
function MetricCard({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: 'ok' | 'bad' | 'warn' | '';
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card panel-pad text-card-foreground shadow-float">
      <div className={`text-2xl font-semibold tabular-nums ${METRIC_TONES[tone] ?? ''}`}>
        {value}
      </div>
      <div className="mt-1 t-supporting text-muted-foreground">{label}</div>
    </div>
  );
}

/** descriptions 单列描边行（源 el-descriptions :column="1" border）。 */
function DescRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 px-4 py-2.5 sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-3">
      <div className="t-supporting text-muted-foreground">{label}</div>
      <div className="min-w-0 t-data">{children}</div>
    </div>
  );
}

/**
 * 分段单选按钮组（源 el-radio-group size=small + el-radio-button 的连体
 * 描边样式）：period 四档与 volume pair/symbol 维度切换共用同一视觉。
 */
function SegmentedRadioGroup<T extends string>({
  options,
  value,
  onSelect,
  ariaLabel,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onSelect: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex overflow-hidden rounded-md border"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onSelect(option.value)}
          className={
            value === option.value
              ? 'h-8 border-border px-3 text-sm font-medium border-y border-l last:border-r bg-primary text-primary-foreground'
              : 'h-8 border-border px-3 text-sm font-medium border-y border-l last:border-r hover:bg-muted'
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
