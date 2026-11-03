'use client';

/**
 * Dashboard 落地页（P1 原型对齐，方案 12 §6 Dashboard 行）。
 *
 * 行为源 LPP 原型 `client/src/pages/DashboardPage.jsx`（v4 分区结构），UI 按本
 * 仓体系重实现（t-* 排版角色 + panel-pad/section-gap + shared/ui 件），分区：
 *
 *   ① 页头：标题 + 描述 + As of 胶囊（页级查询最新 dataUpdatedAt）+ Refresh
 *      （重拉页级四路查询并递增 refreshSeq 驱动图卡内查询）。
 *   ② 告警横幅：{n} Pools Require Top-up / Pre-authorization Missing on {n}，
 *      全清时绿色 all-clear。summary 无此聚合字段（GAP-LP-01），由 /pool/list
 *      真实行推导（GAP 记录「pools 端点可换算则真数据」口径），可关闭。
 *   ③ KPI 四卡（2026-11-03 重设计）：四张卡统一为**纯计数**指标，单位无关、
 *      不跨 token 求和 —— Active Token Pairs（stats.pairsActive，副行 x of y
 *      configured）/ Liquidity Pools（启用池数，副行 above minimum 数）/
 *      Completed Transactions（stats.txCompleted，All time）/ FX Transactions
 *      Today（stats.txToday，副行窗口日均）。原「Total Pool Balance」因跨 token
 *      余额相加无意义而退役。
 *   ④ My Liquidity Pools：All/Healthy/Below Minimum 筛选（默认 Below Minimum），
 *      每页 4 卡分页，真数据 /pool/list（activeFlag=1 为 Payout 池打标；水位条以 45.6% 刻度线
 *      标 Min. Liquidity，<100% 红显）。
 *   ⑤ Transaction Volume & Flow（近 30 天按日全状态笔数，7D/14D/30D 客户端
 *      切片；volume 端点 txCount 按日求和真算），全宽铺满内容区。
 *   ⑥ 底部双 Tab：Configured Pairs & Spread（默认）/ Recent FX Transactions
 *      （首页 5 笔），真数据 pair/tx-flow queries；Details/View all 跳对应
 *      列表页。
 *
 * 降级：页级查询错误经 isServiceDown 聚合 → 单条 ServiceDownAlert（旧数据保
 * 留不清空）；各分区另有 pending Skeleton 与非降级错误 "Failed to load." +
 * Retry 态。
 */
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from '@myorg/shared/util-i18n';
import {
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  Layers,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';

import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { cn } from '@myorg/shared/util-classnames';
import type { ColumnDef } from '@tanstack/react-table';

import {
  Badge,
  Button,
  Card,
  CardContent,
  DataTable,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TooltipProvider,
} from '@myorg/shared/ui';

import {
  LP_PROJECT_ID,
  isServiceDown,
  useDashboardSummaryQuery,
  useDashboardVolumeQuery,
  usePairListQuery,
  usePoolListQuery,
  useTokenMeta,
  useTxFlowListQuery,
  type PairRow,
  type PoolRow,
  type VolumeRow,
  type TxFlowListReq,
  type TxRow,
} from '@myorg/modules/lp-portal/data-access';

import {
  LP_PAIR_READINESS_MAP,
  LP_PAIR_STATUS_MAP,
  LP_TX_STATUS_MAP,
} from './proto-enums';
import { formatRate, formatTokenAmount, formatUtc8 } from './proto-format';
import { CopyableId, ProtoStatusBadge, type ProtoTone } from './proto-ui';
import { usePoolCoverageMap, type LpPoolCoverage } from './pool-coverage';
import { ServiceDownAlert } from './service-down-alert';
import { shortDayLabel, type VolumePoint } from './volume-chart';

/* ================================================================== */
/* 文案（原型 DashboardPage.jsx 英文 copy 逐字；插值 {var}）              */
/* ================================================================== */

const LBL = {
  title: 'Dashboard',
  description:
    'Real-time liquidity, settlement and FX activity across your pools and token pairs.',
  asOf: 'As of',
  refresh: 'Refresh',
  dismiss: 'Dismiss',
  prev: 'Previous',
  next: 'Next',
  bannerWarn: 'Liquidity Notice',
  bannerOk: 'All pools operational',
  bannerOkBody: 'No top-up or pre-authorization issues.',
  bannerTopUp: '{count} Pools Require Top-up',
  bannerPreAuth: 'Pre-authorization Missing on {count}',
  kpiPairs: 'Active Token Pairs',
  kpiPairsFoot: 'of {configured} configured',
  kpiPairsFootPlain: 'Your active participations',
  kpiPools: 'Liquidity Pools',
  kpiPoolsFoot: '{healthy} of {total} above alert line',
  kpiTotal: 'Completed Transactions',
  kpiTotalInfo:
    'Completed FX transfers (status 35/40) since onboarding. Counts only — amounts are per token and never summed across tokens.',
  kpiTotalFoot: 'All time',
  kpiToday: 'FX Transactions Today',
  kpiTodayInfo: 'FX transactions completed in the current GMT+8 day.',
  kpiTodayFoot: 'Resets daily at 00:00 (UTC+8)',
  kpiTodayAvgFoot: '{avg}/day avg',
  kpiMtd: 'Revenue Share (MTD)',
  kpiMtdInfo:
    'Revenue Share (MTD) = the sum of My Share in Revenue Share Details, accrued since the 1st of the current month.',
  kpiMtdFoot: 'Next cycle: {date}',
  poolsTitle: 'My Liquidity Pools',
  poolsConfigured: '{count} configured',
  poolsTabAll: 'All',
  poolsTabHealthy: 'Healthy',
  poolsTabBelow: 'Below Minimum',
  poolsShowing: 'Showing {from}-{to} of {total} pools',
  poolsEmpty: 'No liquidity pools',
  poolPayout: 'Payout',
  poolLevel: 'Liq. Coverage',
  poolLevelInfo: 'Available Balance ÷ Min. Liquidity',
  poolAuthorized: 'Authorized Amount',
  poolAvail: 'Avail',
  rangeGroup: 'Date range',
  volumeTitle: 'Transaction Volume & Flow',
  volumeSub: 'Daily transactions in the last {days} days.',
  volumeTotal: 'Total transactions',
  volumeAvg: 'Avg daily',
  volumePeak: 'Peak day',
  volumePeakInfo:
    'Peak day is the day with the highest transaction count in the selected window, shown as date · count.',
  volumeLegend: 'Daily transactions',
  volumeEmpty: 'No transaction volume data in the selected window.',
  tabPairs: 'Configured Pairs & Spread',
  tabTx: 'Recent FX Transactions',
  tabSub: 'FX activity and configured pair terms.',
  viewAll: 'View all',
  details: 'Details',
  colTokenPair: 'Token Pair',
  colClientRate: 'Client Rate',
  colMarkup: 'Markup',
  colStandardShare: 'Standard Share',
  colMyShare: 'My Share',
  colReadiness: 'Readiness',
  colStatus: 'Status',
  colTxNo: 'Transaction No.',
  colAmount: 'Amount',
  colFxRate: 'FX Rate',
  colCreated: 'Created on',
  badgePoolNotReady: 'Pool not ready',
  badgePreauthSet: 'Pre-authorization set',
  pairsShowing: 'Showing {count} of {total} pairs',
  txShowing: 'Showing {count} of {total} transactions',
  emptyRecords: 'No records found',
  failed: 'Failed to load.',
  retry: 'Retry',
  scaleGroup: 'My network at a glance',
  noActivePools: 'No active pools',
  attentionTitle: 'Needs attention',
  attentionTopUp: 'Pools requiring top-up',
  attentionTopUpNote: 'Coverage is 0% — payouts will fail',
  attentionPreAuth: 'Pre-authorization missing',
  attentionPreAuthNote: 'Payouts need an approved pre-authorization',
  attentionClear: 'Nothing needs attention right now.',
  poolHealthTitle: 'Pool health',
  healthHealthy: 'Above alert line',
  healthBelow: 'Below alert line',
  poolGapToLine: 'Below line by',
  healthIdle: 'No active pairs',
  volumeByPairTitle: 'Volume by pair',
  badgeNoPreauth: 'Pre-auth missing',
} as const;

/* ================================================================== */
/* 静态补齐（GAP-LP-01：Dashboard summary 无营收/结算聚合，缺口与补齐    */
/* 语义见 .doc/kissen/kissen-bug/2026-09-23-原型对齐-API缺口与静态补齐记录.md）*/
/* ================================================================== */

// 2026-11-03：原「Total Pool Balance」KPI 退役——跨 token 余额相加无意义
// （不同币种单位不同，多 token 时只能显示 '-'，等于一个永远空着的卡片）。
// 顶排改为纯计数指标：token 对 / 资金池 / 累计完成笔数 / 今日笔数，单位无关、可跨 token 比较。

/* ================================================================== */
/* 常量与渲染辅助                                                        */
/* ================================================================== */

/** 图表窗口：端点固定取 30 天，7/14/30 客户端切片（原型 VOLUME_RANGES）。 */
const VOLUME_WINDOW_DAYS = 30;
const VOLUME_RANGES = [7, 14, 30] as const;
/** 底部 Recent FX Transactions 首页条数（原型 pageSize）。 */
const RECENT_TX_PAGE_SIZE = 5;
/** Active 池状态码（/pool 语义）。 */
const STATUS_ACTIVE = 20;

/**
 * 固定告警线：覆盖率低于 20% 才算 Low 并会通知 LP（2026-11-03 裁决）。
 * 与后端 `PoolAlertMath.ALERT_RATIO`、资金池页 `COVERAGE_ALERT_PERCENT` 必须一致。
 */
const COVERAGE_ALERT_PERCENT = 20;

/** LBL 模板插值：'{count} configured' + {count: 3} → '3 configured'（原型 t() 同构）。 */
/** token 身份键归一：tokenNo 优先（全网唯一），缺失回退 tokenCode（旧数据/BFF 未升级兼容）。 */
function srcKey(r: {
  sourceTokenNo?: string;
  sourceTokenCode?: string;
}): string | undefined {
  return r.sourceTokenNo || r.sourceTokenCode;
}

function tgtKey(r: {
  targetTokenNo?: string;
  targetTokenCode?: string;
}): string | undefined {
  return r.targetTokenNo || r.targetTokenCode;
}

function tpl(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
}

/** 比值 → 固定 2 位小数百分比（'0.03' → '3.00%'；空/非数 → '-'；原型 toPercent 同构）。 */
function ratioPercent(v: string | number | null | undefined): string {
  if (v == null || v === '') return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return `${(n * 100).toFixed(2)}%`;
}

/** 用户/成交汇率（比值，4 位小数）；0/null = 无快照显 '-'（模型 v2.4 口径）。 */
function clientRateText(v: string | number | null | undefined): string {
  if (v == null || v === '') return '-';
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return '-';
  return formatRate(v);
}

/** 单侧金额 + 符号（空 → '-'）。 */
function amountText(
  v: string | number | null | undefined,
  symbol: string,
): string {
  if (v == null || v === '') return '-';
  return `${formatTokenAmount(v)} ${symbol}`;
}

/** 近 N 天 GMT+8 日切 'YYYY-MM-DD' 序列（与 volume 端点 day 口径一致，旧 → 新）。 */
function utc8Days(count: number): string[] {
  const pad = (n: number) => String(n).padStart(2, '0');
  const days: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.now() + 8 * 3_600_000 - i * 86_400_000);
    days.push(
      `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    );
  }
  return days;
}

/** 枚举映射条目缺码兜底：显原值。 */
function enumLabel(
  map: Record<number, { label: string }>,
  code: number,
): string {
  return map[code]?.label ?? String(code);
}

/* —— 状态 → 徽章语义色（生命周期能级：待审黄 / 生效绿 / 停用灰 / 驳回红） —— */

const PAIR_TONE: Record<number, ProtoTone> = {
  5: 'warning',
  20: 'success',
  50: 'muted',
  15: 'danger',
};

/** 交易状态：完成系绿、终态失败/冲正/取消红、在途蓝、未启动灰（LP_TX_STATUS_MAP 文案）。 */
const TX_TONE: Record<number, ProtoTone> = {
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

/* —— 表格数值排版（pair-pages .num 体系同构） —— */

/** 数值文本（等宽字体 + 表格数字对齐）。 */
function Num({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`font-mono text-xs tabular-nums ${className}`}>
      {children}
    </span>
  );
}

/** 右对齐数值列表头。 */
function NumHeader({ children }: { children: React.ReactNode }) {
  return <div className="text-right">{children}</div>;
}

/** 右对齐数值单元格。 */
function NumCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex justify-end', className)}>
      <Num>{children}</Num>
    </div>
  );
}

/** 币对单元格：第一行 symOf(src)/symOf(tgt) 等宽加粗、第二行发行行次行（§E24）。 */
function TokenPairCell({ tokens, banks }: { tokens: string; banks: string }) {
  return (
    <div className="whitespace-nowrap">
      <div className="font-mono text-xs font-semibold tabular-nums">{tokens}</div>
      <div className="text-xs text-muted-foreground">{banks}</div>
    </div>
  );
}

/** 分区错误态（非 0024 降级；0024 由页面级 ServiceDownAlert 承担，旧数据保留）。 */
function SectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 py-6 text-sm text-muted-foreground"
    >
      <p>{LBL.failed}</p>
      <Button size="xs" variant="outline" onClick={onRetry}>
        {LBL.retry}
      </Button>
    </div>
  );
}

/** 统一面板卡（admin Dashboard 同构：标题行 + 内容，无内建 padding 假设）。 */
function PanelCard({
  title,
  subtitle,
  action,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn('flex min-w-0 flex-col p-4 min-[1600px]:p-6', className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle ? (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}
/* ================================================================== */
/* 我的资金池                                                            */
/* ================================================================== */

/** 预授权额度缺失 / 为 0：解付会失败，单独成一条告警。 */
function isPreAuthMissing(pool: PoolRow): boolean {
  const raw = pool.preauthAuthAmount;
  if (raw == null || raw === '') return true;
  const n = Number(raw);
  return !Number.isFinite(n) || n === 0;
}

/** 我的资金池（admin「Liquidity risk」版式：覆盖率升序 + 轨道 + 状态 + 缺口）。 */
function PoolsListCard({
  pools,
  coverageByPool,
  isPending,
  failed,
  onRetry,
}: {
  pools: PoolRow[];
  /** poolId → 覆盖率（与 /pool 列表页同一份口径：token 级 Min. Liquidity）。 */
  coverageByPool: ReadonlyMap<number, LpPoolCoverage>;
  isPending: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const sorted = React.useMemo(
    () =>
      [...pools].sort(
        (a, b) =>
          (coverageByPool.get(a.poolId)?.percentage ?? -1) -
          (coverageByPool.get(b.poolId)?.percentage ?? -1),
      ),
    [pools, coverageByPool],
  );

  return (
    <PanelCard
      title={LBL.poolsTitle}
      subtitle={tpl(LBL.poolsConfigured, { count: pools.length })}
      action={
        <Link
          className="text-xs font-medium text-primary hover:underline"
          href="/pool"
        >
          {LBL.viewAll}
        </Link>
      }
    >
      {isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : failed ? (
        <SectionError onRetry={onRetry} />
      ) : pools.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {LBL.poolsEmpty}
        </p>
      ) : (
        <div className="flex flex-col">
          {sorted.map((pool) => {
            const symbol = pool.tokenSymbol || pool.tokenNo || '';
            const coverage = coverageByPool.get(pool.poolId) ?? null;
            const percent = coverage?.percentage ?? null;
            // 与资金池页/后端监控同一条线：覆盖率 < 20% 才算 Low（会通知 LP）
            const low = percent != null && percent < COVERAGE_ALERT_PERCENT;
            const noAuth = isPreAuthMissing(pool);
            // 缺口 = 回到 20% 告警线还差多少（不是差到 100%，避免「23% 却显示缺 7,716」的割裂）
            const gapToLine =
              coverage != null
                ? Math.max(
                    0,
                    Math.round(
                      ((COVERAGE_ALERT_PERCENT / 100) * coverage.requiredMin -
                        coverage.numerator) *
                        100,
                    ) / 100,
                  )
                : null;
            return (
              <div
                key={pool.poolId}
                className="space-y-2 border-b border-border py-3 first:pt-0 last:border-b-0 last:pb-0"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-medium">
                      {pool.tokenName || symbol || '-'}
                    </span>
                    {symbol ? (
                      <span className="text-xs text-muted-foreground">
                        {symbol}
                      </span>
                    ) : null}
                    {pool.activeFlag === 1 ? (
                      <Badge variant="success" size="sm">
                        {LBL.poolPayout}
                      </Badge>
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 font-mono text-sm font-semibold tabular-nums',
                      low ? 'text-destructive' : 'text-foreground',
                    )}
                  >
                    {percent == null ? '-' : `${percent}%`}
                  </span>
                </div>
                <CopyableId
                  value={pool.poolAddress}
                  className="t-identifier text-muted-foreground"
                />
                <div className="relative h-1.5 rounded bg-muted">
                  <div
                    className={cn(
                      'h-full rounded',
                      percent != null && percent <= 0
                        ? 'bg-destructive'
                        : low
                          ? 'bg-warning'
                          : 'bg-success',
                    )}
                    style={{
                      width: `${Math.max(0, Math.min(100, percent ?? 0))}%`,
                    }}
                  />
                  {/* 20% 告警竖线，与资金池页同一条线 */}
                  <span
                    aria-hidden="true"
                    className="absolute -inset-y-[3px] w-0.5 bg-foreground/40"
                    style={{ left: `${COVERAGE_ALERT_PERCENT}%` }}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <ProtoStatusBadge
                    label={
                      low
                        ? LBL.healthBelow
                        : noAuth
                          ? LBL.badgeNoPreauth
                          : LBL.healthHealthy
                    }
                    tone={low ? 'danger' : noAuth ? 'warning' : 'success'}
                  />
                  <span className="text-xs text-muted-foreground">
                    {gapToLine != null && gapToLine > 0 ? (
                      <>
                        {LBL.poolGapToLine}{' '}
                        <span className="tabular-nums">
                          {formatTokenAmount(gapToLine)}
                          {symbol ? ` ${symbol}` : ''}
                        </span>
                      </>
                    ) : (
                      <span className="tabular-nums">
                        {formatTokenAmount(pool.availableBalanceCache)}
                        {symbol ? ` ${symbol}` : ''}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PanelCard>
  );
}

/* ================================================================== */
/* Transaction Volume（面积图 + 指标行）                                   */
/* ================================================================== */

function RangeSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (days: number) => void;
}) {
  return (
    <div className="flex gap-1" role="group" aria-label={LBL.rangeGroup}>
      {VOLUME_RANGES.map((days) => (
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

function TrafficPanel({
  points,
  range,
  isPending,
  failed,
  onRetry,
}: {
  points: VolumePoint[];
  range: number;
  isPending: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const total = points.reduce((sum, point) => sum + point.count, 0);
  const peak = points.reduce<VolumePoint | null>(
    (best, point) => (point.count > (best?.count ?? -1) ? point : best),
    null,
  );
  const avg =
    points.length > 0 ? Math.round((total / points.length) * 10) / 10 : 0;
  const series = points.map((point) => ({
    day: point.day,
    count: point.count,
  }));

  return (
    <PanelCard
      title={LBL.volumeTitle}
      subtitle={tpl(LBL.volumeSub, { days: range })}
      action={
        <span className="text-xs text-muted-foreground">Last {range} days</span>
      }
      className="h-full min-h-[420px]"
    >
      {isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : failed ? (
        <SectionError onRetry={onRetry} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-border pb-3 text-xs">
            <span className="text-muted-foreground">
              Transfers
              <span className="ml-2 font-mono text-sm font-semibold tabular-nums text-foreground">
                {total.toLocaleString('en-US')}
              </span>
            </span>
            <span className="text-muted-foreground">
              Avg daily
              <span className="ml-2 font-mono text-sm font-semibold tabular-nums text-foreground">
                {avg}
              </span>
            </span>
            <span className="text-muted-foreground">
              Peak day
              <span className="ml-2 font-mono text-sm font-semibold tabular-nums text-foreground">
                {peak && peak.count > 0
                  ? `${shortDayLabel(peak.day)} · ${peak.count}`
                  : '—'}
              </span>
            </span>
          </div>
          {total === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {LBL.volumeEmpty}
            </p>
          ) : (
            <div
              className="h-64 flex-1"
              role="img"
              aria-label={LBL.volumeLegend}
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series}>
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tickFormatter={(value) => String(value).slice(5)}
                    tickLine={false}
                    axisLine={false}
                    tick={{
                      fontSize: 11,
                      fill: 'hsl(var(--muted-foreground))',
                    }}
                  />
                  <YAxis
                    allowDecimals={false}
                    width={32}
                    tickLine={false}
                    axisLine={false}
                    tick={{
                      fontSize: 11,
                      fill: 'hsl(var(--muted-foreground))',
                    }}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      color: 'hsl(var(--foreground))',
                      fontSize: 12,
                    }}
                    labelFormatter={(value) => `Date ${value}`}
                    formatter={(value) => [String(value), LBL.volumeLegend]}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="hsl(var(--primary))"
                    fillOpacity={0.14}
                    activeDot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <span
              aria-hidden="true"
              className="h-0.5 w-3.5 rounded bg-primary"
            />
            {LBL.volumeLegend}
          </div>
        </>
      )}
    </PanelCard>
  );
}

/* ================================================================== */
/* Volume by pair（纵向柱状图）                                           */
/* ================================================================== */

function VolumeByPairCard({
  rows,
  days,
  isPending,
  failed,
  onRetry,
}: {
  rows: VolumeRow[];
  days: number;
  isPending: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const { columns, total, max } = React.useMemo(() => {
    const byPair = new Map<string, number>();
    for (const row of rows) {
      const label =
        row.sourceTokenCode && row.targetTokenCode
          ? `${row.sourceTokenCode}/${row.targetTokenCode}`
          : row.pairCode;
      const count = Number(row.txCount);
      if (!label || !Number.isFinite(count)) continue;
      byPair.set(label, (byPair.get(label) ?? 0) + count);
    }
    const sorted = [...byPair.entries()].sort((a, b) => b[1] - a[1]);
    const columns = sorted.slice(0, 5).map(([label, count]) => ({
      key: label,
      label,
      count,
      muted: false,
    }));
    const rest = sorted.slice(5);
    if (rest.length > 0) {
      columns.push({
        key: 'other',
        label: `Other (${rest.length})`,
        count: rest.reduce((sum, [, count]) => sum + count, 0),
        muted: true,
      });
    }
    const total = columns.reduce((sum, col) => sum + col.count, 0);
    return {
      columns,
      total,
      max: Math.max(1, ...columns.map((col) => col.count)),
    };
  }, [rows]);

  return (
    <PanelCard
      title={LBL.volumeByPairTitle}
      subtitle={`Last ${days} days · ${total.toLocaleString('en-US')} transfers`}
    >
      {isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : failed ? (
        <SectionError onRetry={onRetry} />
      ) : columns.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          {LBL.volumeEmpty}
        </p>
      ) : (
        <>
          {/* 固定高度：柱子按百分比取高，父级必须是确定高度。 */}
          <div className="flex h-[220px] items-end gap-4 border-b border-border pt-7">
            {columns.map((col) => (
              <div
                key={col.key}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                title={`${col.label} · ${col.count} transfers`}
              >
                <span className="mb-2 font-mono text-xs font-semibold tabular-nums">
                  {col.count.toLocaleString('en-US')}
                </span>
                <div
                  className={cn(
                    'w-full max-w-[54px] rounded-t-[3px]',
                    col.muted ? 'bg-muted-foreground/30' : 'bg-primary',
                  )}
                  style={{
                    height: `${Math.max(1.5, (col.count / max) * 88)}%`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-4 pt-2.5">
            {columns.map((col) => (
              <div key={col.key} className="min-w-0 flex-1 text-center">
                <div className="truncate font-mono text-[11px] text-muted-foreground">
                  {col.label}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {total ? Math.round((col.count / total) * 100) : 0}%
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </PanelCard>
  );
}
/* ================================================================== */
/* 底部双 Tab：Configured Pairs & Spread / Recent FX Transactions         */
/* ================================================================== */

/** DataTable 行标识 id:string（TanStack 泛型约束，模型主键转字符串）。 */
type PairMineRow = Omit<PairRow, 'id'> & { id: string };
type RecentTxRow = TxRow & { id: string };

type BottomTabKey = 'pairs' | 'tx';

function BottomTabsCard({
  pairs,
  pairsLoaded,
  pairsPending,
  pairsFailed,
  onRetryPairs,
  recentTx,
  txTotal,
  txLoaded,
  txPending,
  txFailed,
  onRetryTx,
}: {
  pairs: PairRow[];
  pairsLoaded: boolean;
  pairsPending: boolean;
  pairsFailed: boolean;
  onRetryPairs: () => void;
  recentTx: TxRow[];
  txTotal: number;
  txLoaded: boolean;
  txPending: boolean;
  txFailed: boolean;
  onRetryTx: () => void;
}) {
  const { symOf, bankOf } = useTokenMeta(LP_PROJECT_ID);
  const [tab, setTab] = React.useState<BottomTabKey>('pairs');

  const pairTableData = React.useMemo<PairMineRow[]>(
    () => pairs.map((r) => ({ ...r, id: String(r.id) })),
    [pairs],
  );

  const txTableData = React.useMemo<RecentTxRow[]>(
    () => recentTx.map((r) => ({ ...r, id: String(r.transactionId) })),
    [recentTx],
  );

  const pairColumns = React.useMemo<ColumnDef<PairMineRow>[]>(
    () => [
      {
        id: 'tokenPair',
        header: LBL.colTokenPair,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <TokenPairCell
              tokens={`${symOf(srcKey(r))}/${symOf(tgtKey(r))}`}
              banks={`${bankOf(srcKey(r))} → ${bankOf(tgtKey(r))}`}
            />
          );
        },
        meta: { overflow: 'none' },
      },
      {
        accessorKey: 'userRate',
        header: () => <NumHeader>{LBL.colClientRate}</NumHeader>,
        cell: ({ row }) => (
          <NumCell>{clientRateText(row.original.userRate)}</NumCell>
        ),
        meta: { overflow: 'none' },
      },
      {
        accessorKey: 'markupRate',
        header: () => <NumHeader>{LBL.colMarkup}</NumHeader>,
        cell: ({ row }) => (
          <NumCell>{ratioPercent(row.original.markupRate)}</NumCell>
        ),
        meta: { overflow: 'none' },
      },
      {
        accessorKey: 'defaultSplitRatio',
        header: () => <NumHeader>{LBL.colStandardShare}</NumHeader>,
        cell: ({ row }) => (
          <NumCell className="text-muted-foreground">
            {ratioPercent(row.original.defaultSplitRatio)}
          </NumCell>
        ),
        meta: { overflow: 'none' },
      },
      {
        accessorKey: 'mySplitRatio',
        header: () => <NumHeader>{LBL.colMyShare}</NumHeader>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Num className="font-semibold text-success">
              {ratioPercent(row.original.mySplitRatio)}
            </Num>
          </div>
        ),
        meta: { overflow: 'none' },
      },
      {
        id: 'readiness',
        header: LBL.colReadiness,
        cell: ({ row }) => {
          const r = row.original;
          // 原型 Dashboard 底部表 readiness 为池/预授权双徽章；文案取
          // LP_PAIR_READINESS_MAP（'Pool ready'/'Pre-authorization not set'），
          // 反向两条该表独有、就地字面量。
          return (
            <span className="flex flex-wrap items-center gap-1">
              {r.poolReady ? (
                <Badge variant="success" size="sm">
                  {LP_PAIR_READINESS_MAP.poolReady.label}
                </Badge>
              ) : (
                <Badge variant="mute" size="sm">
                  {LBL.badgePoolNotReady}
                </Badge>
              )}
              {r.preauthOk ? (
                <Badge variant="success" size="sm">
                  {LBL.badgePreauthSet}
                </Badge>
              ) : (
                <Badge variant="warning" size="sm">
                  {LP_PAIR_READINESS_MAP.preauthNotSet.label}
                </Badge>
              )}
            </span>
          );
        },
        meta: { overflow: 'none' },
      },
      {
        accessorKey: 'status',
        header: LBL.colStatus,
        cell: ({ row }) => (
          <ProtoStatusBadge
            label={enumLabel(LP_PAIR_STATUS_MAP, row.original.status)}
            tone={PAIR_TONE[row.original.status] ?? 'muted'}
          />
        ),
      },
      {
        id: 'details',
        header: LBL.details,
        cell: () => (
          <Button
            asChild
            variant="link"
            size="sm"
            className="h-auto px-0 text-xs"
          >
            <Link href="/pair">{LBL.details}</Link>
          </Button>
        ),
      },
    ],
    [symOf, bankOf],
  );

  const txColumns = React.useMemo<ColumnDef<RecentTxRow>[]>(
    () => [
      {
        accessorKey: 'txNo',
        header: LBL.colTxNo,
        cell: ({ row }) => (
          <CopyableId
            value={row.original.txNo ?? row.original.txUuid ?? ''}
            className="text-xs"
          />
        ),
        meta: { overflow: 'ellipsis' },
      },
      {
        id: 'tokenPair',
        header: LBL.colTokenPair,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <TokenPairCell
              tokens={`${symOf(srcKey(r))}/${symOf(tgtKey(r))}`}
              banks={`${bankOf(srcKey(r))} → ${bankOf(tgtKey(r))}`}
            />
          );
        },
        meta: { overflow: 'none' },
      },
      {
        id: 'amount',
        header: LBL.colAmount,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <span className="whitespace-nowrap font-mono text-xs tabular-nums">
              <span className="font-semibold">
                {amountText(r.userDeduction, symOf(srcKey(r)))}
              </span>
              <span className="text-muted-foreground">
                {` → ${amountText(r.receiverAmount, symOf(tgtKey(r)))}`}
              </span>
            </span>
          );
        },
        meta: { overflow: 'none' },
      },
      {
        accessorKey: 'userRate',
        header: () => <NumHeader>{LBL.colFxRate}</NumHeader>,
        cell: ({ row }) => (
          <NumCell>{clientRateText(row.original.userRate)}</NumCell>
        ),
        meta: { overflow: 'none' },
      },
      {
        accessorKey: 'status',
        header: LBL.colStatus,
        cell: ({ row }) => (
          <ProtoStatusBadge
            label={enumLabel(LP_TX_STATUS_MAP, row.original.status)}
            tone={TX_TONE[row.original.status] ?? 'muted'}
          />
        ),
      },
      {
        accessorKey: 'createTime',
        header: LBL.colCreated,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs tabular-nums">
            {formatUtc8(row.original.createTime)}
          </span>
        ),
        meta: { overflow: 'none' },
      },
      {
        id: 'details',
        header: LBL.details,
        cell: () => (
          <Button
            asChild
            variant="link"
            size="sm"
            className="h-auto px-0 text-xs"
          >
            <Link href="/tx-flow">{LBL.details}</Link>
          </Button>
        ),
      },
    ],
    [symOf, bankOf],
  );

  return (
    <Card>
      <CardContent className="panel-pad">
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value === 'tx' ? 'tx' : 'pairs')}
        >
          <div className="mb-3 flex flex-col items-stretch gap-2.5 lg:flex-row lg:items-center lg:justify-between lg:gap-x-3">
            <div className="min-w-0">
              <TabsList>
                <TabsTrigger value="pairs">
                  {LBL.tabPairs}
                  <span className="ml-1.5 inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                    {pairs.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="tx">
                  {LBL.tabTx}
                  <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-success">
                    <span
                      aria-hidden="true"
                      className="size-1.5 rounded-full bg-success"
                    />
                    {recentTx.length}
                  </span>
                </TabsTrigger>
              </TabsList>
              <p className="t-supporting mt-1.5 text-muted-foreground">
                {LBL.tabSub}
              </p>
            </div>
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="shrink-0 self-start text-primary"
            >
              <Link href={tab === 'pairs' ? '/pair' : '/tx-flow'}>
                {LBL.viewAll}
                <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </div>

          <TabsContent value="pairs">
            {pairsFailed ? (
              <SectionError onRetry={onRetryPairs} />
            ) : (
              <>
                <DataTable
                  columns={pairColumns}
                  data={pairTableData}
                  isLoading={pairsPending}
                  emptyMessage={LBL.emptyRecords}
                />
                {pairsLoaded && pairs.length > 0 ? (
                  <p className="t-supporting mt-3 text-muted-foreground tabular-nums">
                    {tpl(LBL.pairsShowing, {
                      count: pairs.length,
                      total: pairs.length,
                    })}
                  </p>
                ) : null}
              </>
            )}
          </TabsContent>

          <TabsContent value="tx">
            {txFailed ? (
              <SectionError onRetry={onRetryTx} />
            ) : (
              <>
                <DataTable
                  columns={txColumns}
                  data={txTableData}
                  isLoading={txPending}
                  emptyMessage={LBL.emptyRecords}
                />
                {txLoaded ? (
                  <p className="t-supporting mt-3 text-muted-foreground tabular-nums">
                    {tpl(LBL.txShowing, {
                      count: txTableData.length,
                      total: txTotal,
                    })}
                  </p>
                ) : null}
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

/* ================================================================== */
/* Dashboard 页                                                           */
/* ================================================================== */

export function DashboardPage() {
  const routerPush = useRouter().push;
  const summaryQuery = useDashboardSummaryQuery(LP_PROJECT_ID);
  const poolQuery = usePoolListQuery(LP_PROJECT_ID);
  const pairQuery = usePairListQuery(LP_PROJECT_ID);
  const volumeQuery = useDashboardVolumeQuery(LP_PROJECT_ID, VOLUME_WINDOW_DAYS);
  const recentTxParams = React.useMemo<TxFlowListReq>(
    () => ({ pageNum: 1, pageSize: RECENT_TX_PAGE_SIZE, filter: {} }),
    [],
  );
  const txQuery = useTxFlowListQuery(LP_PROJECT_ID, recentTxParams);

  /** 全页统一窗口：趋势图与「按交易对」共用（7D/14D/30D 客户端切片）。 */
  const [days, setDays] = React.useState<number>(14);

  const pools = poolQuery.data ?? [];
  const activePools = React.useMemo(
    () => pools.filter((p) => p.status === STATUS_ACTIVE),
    [pools],
  );
  const stats = summaryQuery.data?.stats;
  const recentTx = txQuery.data?.data ?? [];
  const recentTxTotal = txQuery.data?.pagination.total ?? recentTx.length;

  /** 0024 聚合降级条（任一页级查询命中即显，旧数据保留）。 */
  const down = React.useMemo(() => {
    for (const err of [
      summaryQuery.error,
      poolQuery.error,
      pairQuery.error,
      txQuery.error,
    ]) {
      if (err != null && isServiceDown(err)) return { traceId: err.traceId };
    }
    return null;
  }, [summaryQuery.error, poolQuery.error, pairQuery.error, txQuery.error]);

  /** 30 天 GMT+8 日切零填充 + 按日笔数求和（全状态，与成交柱状图同源）。 */
  const points30 = React.useMemo<VolumePoint[]>(() => {
    const byDay = new Map<string, number>();
    for (const row of volumeQuery.data ?? []) {
      if (!row.day) continue;
      const n = Number(row.txCount);
      byDay.set(row.day, (byDay.get(row.day) ?? 0) + (Number.isFinite(n) ? n : 0));
    }
    return utc8Days(VOLUME_WINDOW_DAYS).map((day) => ({
      day,
      count: byDay.get(day) ?? 0,
    }));
  }, [volumeQuery.data]);
  const points = React.useMemo(() => points30.slice(-days), [points30, days]);

  /**
   * 池覆盖率（与 /pool 列表页同一份口径：min(余额, 可用授权) ÷ token 级
   * Min. Liquidity）。Dashboard 全页水位/缺口/健康分桶都消费这份结果，
   * 不再用后端 `level`（Σ 参与对门槛旧口径）。
   */
  const coverageByPool = usePoolCoverageMap(activePools);

  /** 池健康分布 + 需处理信号：分桶按 20% 告警线（与资金池页/后端监控同尺）。 */
  const health = React.useMemo(() => {
    let healthy = 0;
    let below = 0;
    let idle = 0;
    let topUp = 0;
    let preAuth = 0;
    for (const p of activePools) {
      const percent = coverageByPool.get(p.poolId)?.percentage ?? null;
      if (percent == null) idle += 1;
      else if (percent >= COVERAGE_ALERT_PERCENT) healthy += 1;
      else below += 1;
      if (percent != null && percent <= 0) topUp += 1;
      if (isPreAuthMissing(p)) preAuth += 1;
    }
    return { healthy, below, idle, topUp, preAuth };
  }, [activePools, coverageByPool]);

  /** 顶排计数指标用的派生值：配置对数 + 窗口内日均笔数（跨 token 唯一可加的量）。 */
  const configuredPairs = pairQuery.data?.length ?? null;
  const avgDailyTx = React.useMemo(() => {
    if (points.length === 0) return null;
    const sum = points.reduce((acc, point) => acc + point.count, 0);
    return Math.round((sum / points.length) * 10) / 10;
  }, [points]);

  const summaryFailed = summaryQuery.error != null && summaryQuery.data == null;
  const poolFailed = poolQuery.error != null && poolQuery.data == null;
  const pairFailed = pairQuery.error != null && pairQuery.data == null;
  const txFailed = txQuery.error != null && txQuery.data == null;
  const volumeFailed = volumeQuery.error != null && volumeQuery.data == null;

  /** As of = 页级查询最新 dataUpdatedAt（无数据 → 0 不显）。 */
  const asOf = Math.max(
    summaryQuery.dataUpdatedAt,
    poolQuery.dataUpdatedAt,
    pairQuery.dataUpdatedAt,
    txQuery.dataUpdatedAt,
    volumeQuery.dataUpdatedAt,
  );

  const anyFetching =
    summaryQuery.isFetching ||
    poolQuery.isFetching ||
    pairQuery.isFetching ||
    txQuery.isFetching ||
    volumeQuery.isFetching;

  function refreshAll() {
    void summaryQuery.refetch();
    void poolQuery.refetch();
    void pairQuery.refetch();
    void txQuery.refetch();
    void volumeQuery.refetch();
  }

  /**
   * 顶部规模条（2026-11-03 重设计）：四张卡统一为**纯计数**指标，单位无关、
   * 不跨 token 求和 —— 交易对 / 资金池 / 累计完成笔数 / 今日笔数。
   * 顺序 = 静态规模（我服务多少）→ 动态规模（我做了多少）。
   */
  const scale = [
    {
      key: 'pairs',
      icon: ArrowLeftRight,
      label: LBL.kpiPairs,
      caption:
        configuredPairs != null
          ? tpl(LBL.kpiPairsFoot, { configured: configuredPairs })
          : LBL.kpiPairsFootPlain,
      value: (
        <span className="tabular-nums">
          {(stats?.pairsActive ?? 0).toLocaleString('en-US')}
        </span>
      ),
      to: '/pair',
      failed: summaryFailed,
      onRetry: () => void summaryQuery.refetch(),
    },
    {
      key: 'pools',
      icon: Layers,
      label: LBL.kpiPools,
      caption:
        activePools.length > 0
          ? tpl(LBL.kpiPoolsFoot, {
              healthy: health.healthy,
              total: activePools.length,
            })
          : LBL.noActivePools,
      value: (
        <span className="tabular-nums">
          {activePools.length.toLocaleString('en-US')}
        </span>
      ),
      to: '/pool',
      failed: poolFailed,
      onRetry: () => void poolQuery.refetch(),
    },
    {
      key: 'total',
      icon: CheckCircle2,
      label: LBL.kpiTotal,
      caption: LBL.kpiTotalFoot,
      value: (
        <span className="tabular-nums">
          {(stats?.txCompleted ?? 0).toLocaleString('en-US')}
        </span>
      ),
      to: '/tx-flow',
      failed: summaryFailed,
      onRetry: () => void summaryQuery.refetch(),
    },
    {
      key: 'today',
      icon: TrendingUp,
      label: LBL.kpiToday,
      caption:
        avgDailyTx != null
          ? tpl(LBL.kpiTodayAvgFoot, { avg: avgDailyTx })
          : LBL.kpiTodayFoot,
      value: (
        <span className="tabular-nums">
          {(stats?.txToday ?? 0).toLocaleString('en-US')}
        </span>
      ),
      to: '/tx-flow',
      failed: summaryFailed,
      onRetry: () => void summaryQuery.refetch(),
    },
  ];

  const attention = [
    health.topUp > 0
      ? {
          key: 'topup',
          label: LBL.attentionTopUp,
          note: LBL.attentionTopUpNote,
          count: health.topUp,
          bar: 'bg-destructive',
        }
      : null,
    health.preAuth > 0
      ? {
          key: 'preauth',
          label: LBL.attentionPreAuth,
          note: LBL.attentionPreAuthNote,
          count: health.preAuth,
          bar: 'bg-warning',
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  const healthRows = [
    { key: 'healthy', label: LBL.healthHealthy, count: health.healthy },
    { key: 'below', label: LBL.healthBelow, count: health.below },
    { key: 'idle', label: LBL.healthIdle, count: health.idle },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-4">
        {/* ① 页头 */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="t-page-title">{LBL.title}</h1>
            <p className="text-xs text-muted-foreground">{LBL.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <RangeSelector value={days} onChange={setDays} />
            {asOf > 0 ? (
              <span className="whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
                {`${LBL.asOf} ${formatUtc8(asOf)}`}
              </span>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={refreshAll}
              disabled={anyFetching}
            >
              <RefreshCw
                className={`h-4 w-4 ${anyFetching ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {LBL.refresh}
            </Button>
          </div>
        </header>

        {/* ② 0024 降级条 */}
        {down ? <ServiceDownAlert traceId={down.traceId} /> : null}

        {/* ③ 规模条 */}
        <section
          aria-label={LBL.scaleGroup}
          className="grid grid-cols-1 divide-y divide-border overflow-hidden rounded-xl border border-border/50 bg-card shadow-float sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x"
        >
          {scale.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => routerPush(item.to)}
                className="flex min-w-0 flex-col gap-1.5 px-4 py-3.5 text-left motion-safe:transition-colors hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="flex min-w-0 items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Icon
                    className="size-3.5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span className="truncate">{item.label}</span>
                  <span className="ml-auto hidden shrink-0 text-[11px] font-normal normal-case tracking-normal sm:inline">
                    {item.caption}
                  </span>
                </span>
                <span className="min-w-0 truncate text-2xl font-semibold tabular-nums">
                  {item.failed ? (
                    <span className="text-sm font-normal text-destructive">
                      {LBL.failed}
                    </span>
                  ) : poolQuery.isPending || summaryQuery.isPending ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    item.value
                  )}
                </span>
              </button>
            );
          })}
        </section>

        {/* ④ 主区：趋势 + 待处理 */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <TrafficPanel
              points={points}
              range={days}
              isPending={volumeQuery.isPending}
              failed={volumeFailed}
              onRetry={() => void volumeQuery.refetch()}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <Card className="flex min-w-0 flex-col overflow-hidden p-0">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">{LBL.attentionTitle}</h2>
              </div>
              {poolQuery.isPending ? (
                <Skeleton className="m-4 h-24" />
              ) : poolFailed ? (
                <div className="p-4">
                  <SectionError onRetry={() => void poolQuery.refetch()} />
                </div>
              ) : attention.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {LBL.attentionClear}
                </p>
              ) : (
                <div className="flex flex-1 flex-col">
                  {attention.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => routerPush('/pool')}
                      className="flex flex-1 items-center gap-3 border-b border-border px-4 py-3.5 text-left last:border-b-0 motion-safe:transition-colors hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <span
                        className={cn(
                          'w-1 self-stretch rounded-full',
                          item.bar,
                        )}
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
                        {item.count}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            <PanelCard title={LBL.poolHealthTitle} className="flex-1">
              <div className="divide-y divide-border">
                {healthRows.map((row) => (
                  <div
                    key={row.key}
                    className="flex items-baseline justify-between gap-2 py-2.5 text-sm first:pt-0 last:pb-0"
                  >
                    <span className="min-w-0 truncate">{row.label}</span>
                    <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                      {poolQuery.isPending ? '—' : row.count}
                    </span>
                  </div>
                ))}
              </div>
            </PanelCard>
          </div>
        </section>

        {/* ⑤ 池 + 按交易对成交 */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.16fr_1fr]">
          <PoolsListCard
            pools={activePools}
            coverageByPool={coverageByPool}
            isPending={poolQuery.isPending}
            failed={poolFailed}
            onRetry={() => void poolQuery.refetch()}
          />
          <VolumeByPairCard
            rows={volumeQuery.data ?? []}
            days={days}
            isPending={volumeQuery.isPending}
            failed={volumeFailed}
            onRetry={() => void volumeQuery.refetch()}
          />
        </section>

        {/* ⑥ 底部双 Tab */}
        <BottomTabsCard
          pairs={pairQuery.data ?? []}
          pairsLoaded={pairQuery.data != null}
          pairsPending={pairQuery.isPending}
          pairsFailed={pairFailed}
          onRetryPairs={() => void pairQuery.refetch()}
          recentTx={recentTx}
          txTotal={recentTxTotal}
          txLoaded={txQuery.data != null}
          txPending={txQuery.isPending}
          txFailed={txFailed}
          onRetryTx={() => void txQuery.refetch()}
        />
      </div>
    </TooltipProvider>
  );
}
