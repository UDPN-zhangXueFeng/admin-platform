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
 *   ③ KPI 四卡：Total Pool Balance（单 token 场景 BigInt 精确求和真算；跨
 *      token 禁相加显 '-'，GAP-LP-01）/ Active Token Pairs（stats.pairsActive）/
 *      FX Transactions Today（stats.txToday）/ Revenue Share (MTD)（静态补齐
 *      GAP-LP-01，不虚构金额）。
 *   ④ My Liquidity Pools：All/Healthy/Below Minimum 筛选 + 每页 4 卡分页，
 *      真数据 /pool/list（activeFlag=1 为 Payout 池打标；水位条以 45.6% 刻度线
 *      标 Min. Liquidity，<100% 红显）。
 *   ⑤ Transaction Volume & Flow（近 30 天按日全状态笔数，7D/14D/30D 客户端
 *      切片；volume 端点 txCount 按日求和真算）+ Revenue & Settlement 右栏
 *      （GAP-LP-01 静态补齐，入口跳 /split-settle）8/4 分栏。
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
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Coins,
  Info,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  X,
} from 'lucide-react';

import type { ColumnDef } from '@tanstack/react-table';

import {
  Alert,
  AlertTitle,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
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
  type TxFlowListReq,
  type TxRow,
} from '@myorg/modules/lp-portal/data-access';

import {
  LP_PAIR_READINESS_MAP,
  LP_PAIR_STATUS_MAP,
  LP_POOL_STATUS_MAP,
  LP_TX_STATUS_MAP,
} from './proto-enums';
import { formatRate, formatTokenAmount, formatUtc8 } from './proto-format';
import { CopyableId, ProtoStatusBadge, type ProtoTone } from './proto-ui';
import { ServiceDownAlert } from './service-down-alert';
import {
  VolumeBarChart,
  VolumeChartEmpty,
  shortDayLabel,
  type VolumePoint,
} from './volume-chart';

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
  kpiBalance: 'Total Pool Balance',
  kpiBalanceInfo:
    'Total Pool Balance = the sum of Available Balance across all active pools.',
  kpiBalanceFoot: 'Across {pools} pools · {tokens} tokens',
  kpiPairs: 'Active Token Pairs',
  kpiPairsFoot: 'Your active participations',
  kpiToday: 'FX Transactions Today',
  kpiTodayInfo: 'FX transactions completed in the current GMT+8 day.',
  kpiTodayFoot: 'Resets daily at 00:00 (UTC+8)',
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
  revenueTitle: 'Revenue & Settlement',
  revenueBadge: 'Cycle MTD',
  revenueMyShare: 'My Share (MTD)',
  revenueNext: 'Next payout cycle: {date} (in {count} days)',
  revenuePending: 'Pending Confirmation',
  revenuePendingSub: 'Awaiting block finalization',
  revenueByToken: 'Pending settlement by token',
  revenueViewShare: 'View Revenue Share Details',
  revenueViewStatements: 'View Settlement Statements',
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
  colCreated: 'Created on (UTC+8)',
  badgePoolNotReady: 'Pool not ready',
  badgePreauthSet: 'Pre-authorization set',
  pairsShowing: 'Showing {count} of {total} pairs',
  txShowing: 'Showing {count} of {total} transactions',
  emptyRecords: 'No records found',
  failed: 'Failed to load.',
  retry: 'Retry',
} as const;

/* ================================================================== */
/* 静态补齐（GAP-LP-01：Dashboard summary 无营收/结算聚合，缺口与补齐    */
/* 语义见 .doc/kissen/kissen-bug/2026-09-23-原型对齐-API缺口与静态补齐记录.md）*/
/* ================================================================== */

// STATIC-FILLER(GAP-LP-01): 本月（MTD）My Share 合计无端点；以 0.00 占位，
// 后端补齐前不虚构金额（口径 = 分成明细 my_share 当月合计，token 维度同缺）。
const REVENUE_SHARE_MTD_FALLBACK = {
  amount: '0.00' as string | null,
  token: null as string | null,
};

// STATIC-FILLER(GAP-LP-01): Pending Confirmation 结算单计数无端点；静态 0
// （>0 才转警示色，0 不虚报待确认）。
const PENDING_CONFIRMATION_FALLBACK = 0;

// STATIC-FILLER(GAP-LP-01): settlementByToken（未决算 my_share 按 token 合计）
// 无端点；空数组 → 网格显 '-' 占位，不虚构 token 明细。
const SETTLEMENT_BY_TOKEN_FALLBACK: Array<{ token: string; myShare: string }> =
  [];

// STATIC-FILLER(GAP-LP-01): Total Pool Balance 跨 token 合计无后端口径；
// 多 token 时跨币种禁相加（方案 §9.5）→ null → '-'，仅单 token 场景真算合计。
const TOTAL_POOL_BALANCE_MULTI_TOKEN = null as string | null;

/* ================================================================== */
/* 常量与渲染辅助                                                        */
/* ================================================================== */

/** 水位 100%（= Min. Liquidity）在轨道上的刻度线位置（原型 COVERAGE_BAR_SCALE）。 */
const COVERAGE_BAR_SCALE = 0.456;
const MIN_LEVEL_MARK = COVERAGE_BAR_SCALE * 100;
/** 池卡每页 4 张（原型 POOLS_PAGE_SIZE）。 */
const POOLS_PAGE_SIZE = 4;
/** 图表窗口：端点固定取 30 天，7/14/30 客户端切片（原型 VOLUME_RANGES）。 */
const VOLUME_WINDOW_DAYS = 30;
const VOLUME_RANGES = [7, 14, 30] as const;
/** 底部 Recent FX Transactions 首页条数（原型 pageSize）。 */
const RECENT_TX_PAGE_SIZE = 5;
/** Active 池状态码（/pool 语义）。 */
const STATUS_ACTIVE = 20;

/** LBL 模板插值：'{count} configured' + {count: 3} → '3 configured'（原型 t() 同构）。 */
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

/**
 * 十进制金额字符串精确求和（对齐小数位后 BigInt 相加；任一非法 → null）。
 * 跨 token 合计由调用方先行拦截，此处只做同币种算术。
 */
function sumDecimalStrings(
  values: Array<string | number | null | undefined>,
): string | null {
  const parts: Array<{ neg: boolean; digits: string; scale: number }> = [];
  let maxScale = 0;
  for (const v of values) {
    if (v === null || v === undefined || v === '') continue;
    const m = /^(-?)(\d*)(?:\.(\d*))?$/.exec(String(v).trim());
    if (!m) return null;
    const neg = m[1] === '-';
    const int = m[2] === '' ? '0' : m[2];
    const frac = m[3] ?? '';
    maxScale = Math.max(maxScale, frac.length);
    parts.push({ neg, digits: int + frac, scale: frac.length });
  }
  if (parts.length === 0) return null;
  let total = 0n;
  for (const p of parts) {
    const padded = p.digits + '0'.repeat(maxScale - p.scale);
    const value = BigInt(padded);
    total += p.neg ? -value : value;
  }
  const neg = total < 0n;
  const digits = (neg ? -total : total).toString().padStart(maxScale + 1, '0');
  const body =
    maxScale === 0 ? digits : `${digits.slice(0, -maxScale)}.${digits.slice(-maxScale)}`;
  return (neg ? '-' : '') + body;
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

/** 下个结算周期日（自然月制，下月 1 日 'YYYY-MM-01'；原型 lpp-routes 同构）。 */
function nextCycleEndIso(): string {
  const now = new Date();
  const nextMonthIndex = (now.getUTCMonth() + 1) % 12;
  const year = now.getUTCFullYear() + (nextMonthIndex === 0 ? 1 : 0);
  return `${year}-${String(nextMonthIndex + 1).padStart(2, '0')}-01`;
}

/** 距下个周期日的整数天数（UTC 日切；非法日期 → null）。 */
function daysUntil(isoDay: string): number | null {
  const target = new Date(`${isoDay}T00:00:00Z`).getTime();
  if (!Number.isFinite(target)) return null;
  const today = new Date();
  const todayStart = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  return Math.round((target - todayStart) / 86_400_000);
}

/** 枚举映射条目缺码兜底：显原值。 */
function enumLabel(
  map: Record<number, { label: string }>,
  code: number,
): string {
  return map[code]?.label ?? String(code);
}

/* —— 状态 → 徽章语义色（生命周期能级：待审黄 / 生效绿 / 停用灰 / 驳回红） —— */

const POOL_TONE: Record<number, ProtoTone> = {
  5: 'warning',
  20: 'success',
  50: 'muted',
  15: 'danger',
};

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

/** KPI 卡顶部色条（tone → 语义色）。 */
const BAR_TONE: Record<ProtoTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  info: 'bg-info',
  primary: 'bg-primary',
  muted: 'bg-muted-foreground/40',
};

/** KPI 图标芯片底色（tone → 语义色 10% 底）。 */
const CHIP_TONE: Record<ProtoTone, string> = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-destructive/10 text-destructive',
  info: 'bg-info/10 text-info',
  primary: 'bg-primary/10 text-primary',
  muted: 'bg-muted text-muted-foreground',
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
function NumCell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
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

/** ⓘ 口径提示（共享 Tooltip，禁原生 title）。 */
function InfoHint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          role="note"
          aria-label={text}
          className="inline-flex cursor-help items-center text-muted-foreground transition-colors hover:text-foreground"
        >
          <Info className="h-[13px] w-[13px]" aria-hidden="true" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{text}</TooltipContent>
    </Tooltip>
  );
}

/** 双段金额：数值（formatTokenAmount）+ token 符号次级；空值整体 '-'。 */
function AmountWithToken({
  value,
  token,
  className = '',
}: {
  value: string | number | null | undefined;
  token?: string | null;
  className?: string;
}) {
  if (value === null || value === undefined || value === '') {
    return <span className={className}>-</span>;
  }
  return (
    <span className={className}>
      {formatTokenAmount(value)}
      {token ? (
        <span className="ml-1 text-xs font-semibold text-muted-foreground">
          {token}
        </span>
      ) : null}
    </span>
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

/** KPI 卡（原型 StatCard：顶部色条 + label/ⓘ + 大数值 + 底部脚注）。 */
function StatCard({
  icon: Icon,
  tone,
  label,
  info,
  value,
  footer,
  failed = false,
  onRetry,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: ProtoTone;
  label: string;
  info?: string;
  value: React.ReactNode;
  footer?: React.ReactNode;
  failed?: boolean;
  onRetry?: () => void;
}) {
  return (
    <Card className="relative flex min-w-0 flex-col overflow-hidden">
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-0.5 ${BAR_TONE[tone]}`}
      />
      <CardContent className="panel-pad flex flex-1 flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="t-supporting flex min-w-0 items-center gap-1 font-semibold tracking-wide text-muted-foreground">
            {label}
            {info ? <InfoHint text={info} /> : null}
          </span>
          <span
            aria-hidden="true"
            className={`grid size-7 shrink-0 place-items-center rounded-md ${CHIP_TONE[tone]}`}
          >
            <Icon className="h-[15px] w-[15px]" />
          </span>
        </div>
        {failed ? (
          <div className="flex flex-wrap items-center gap-2 text-sm font-normal text-destructive">
            <span>{LBL.failed}</span>
            {onRetry ? (
              <Button size="xs" variant="outline" onClick={onRetry}>
                {LBL.retry}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="min-w-0 text-2xl font-bold leading-none tracking-tight tabular-nums">
            {value}
          </div>
        )}
        {footer ? (
          <div className="mt-auto border-t pt-2.5 text-xs text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ================================================================== */
/* My Liquidity Pools                                                    */
/* ================================================================== */

/** 水位块：Liq. Coverage 百分比（口径 ⓘ）+ 轨道 + Min. Liquidity 刻度线。 */
function PoolLevelBox({ level }: { level: string | null }) {
  const n = level == null || level === '' ? null : Number(level);
  const percent = n != null && Number.isFinite(n) ? Math.round(n * 100) : 0;
  const belowMin = percent < 100;
  const fillWidth = Math.min(100, Math.round(percent * COVERAGE_BAR_SCALE));
  return (
    <div className="space-y-1.5 rounded-lg bg-muted/40 p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="t-supporting text-muted-foreground">
          {LBL.poolLevel}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={`t-data cursor-help font-bold ${belowMin ? 'text-destructive' : ''}`}
            >
              {percent}%
            </span>
          </TooltipTrigger>
          <TooltipContent>{LBL.poolLevelInfo}</TooltipContent>
        </Tooltip>
      </div>
      <span
        aria-hidden="true"
        className="relative block h-1.5 rounded-full bg-muted-foreground/20"
      >
        <span
          className={`absolute inset-y-0 left-0 rounded-full ${belowMin ? 'bg-destructive' : 'bg-success'}`}
          style={{ width: `${fillWidth}%` }}
        />
        <span
          className="absolute -inset-y-[3px] w-0.5 rounded-full bg-muted-foreground/60"
          style={{ left: `${MIN_LEVEL_MARK}%` }}
        />
      </span>
    </div>
  );
}

/** 池卡（原型 PoolCard）：银行/token 芯片 + Payout 徽章 + 状态徽章 + 可用余额 +
 * 池地址 CopyableId + 水位块 + Authorized Amount/Avail。 */
function PoolCard({ pool }: { pool: PoolRow }) {
  const symbol = pool.tokenSymbol || pool.tokenNo || '';
  return (
    <Card className="flex min-w-0 flex-col">
      <CardContent className="panel-pad flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            {pool.bankCode ? (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                {pool.bankCode}
              </span>
            ) : null}
            {symbol ? (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                {symbol}
              </span>
            ) : null}
            {pool.activeFlag === 1 ? (
              <Badge variant="success" size="sm">
                {LBL.poolPayout}
              </Badge>
            ) : null}
          </span>
          <ProtoStatusBadge
            label={enumLabel(LP_POOL_STATUS_MAP, pool.status)}
            tone={POOL_TONE[pool.status] ?? 'muted'}
          />
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="t-body min-w-0 truncate font-semibold">
              {pool.tokenName || symbol || '-'}
            </h3>
            <span className="t-data shrink-0 whitespace-nowrap font-bold">
              <AmountWithToken value={pool.availableBalanceCache} token={symbol} />
            </span>
          </div>
          <div className="mt-1 min-w-0">
            <CopyableId
              value={pool.poolAddress}
              className="t-identifier text-muted-foreground"
            />
          </div>
        </div>
        <PoolLevelBox level={pool.level} />
        <div className="mt-auto border-t pt-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="t-supporting text-muted-foreground">
              {LBL.poolAuthorized}
            </span>
            <span className="t-data min-w-0 text-right font-semibold">
              <AmountWithToken value={pool.preauthAuthAmount ?? null} token={symbol} />
            </span>
          </div>
          {pool.preauthAvailableAmount != null &&
          pool.preauthAvailableAmount !== '' ? (
            <div className="mt-0.5 flex items-center justify-between gap-3">
              <span className="t-supporting text-muted-foreground">
                {LBL.poolAvail}
              </span>
              <span className="t-supporting min-w-0 text-right tabular-nums text-muted-foreground">
                {amountText(pool.preauthAvailableAmount, symbol)}
              </span>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

type PoolTabKey = 'all' | 'healthy' | 'below';

/** 池分区：All/Healthy/Below Minimum 筛选（Healthy = 水位 ≥100%）+ 每页 4 卡。 */
function PoolsSection({
  pools,
  isPending,
  failed,
  onRetry,
}: {
  pools: PoolRow[];
  isPending: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const [tab, setTab] = React.useState<PoolTabKey>('all');
  const [page, setPage] = React.useState(1);

  const { healthy, below } = React.useMemo(() => {
    const ok: PoolRow[] = [];
    const low: PoolRow[] = [];
    for (const p of pools) {
      const n = p.level == null || p.level === '' ? null : Number(p.level);
      if (n != null && Number.isFinite(n) && n >= 1) ok.push(p);
      else low.push(p);
    }
    return { healthy: ok, below: low };
  }, [pools]);

  const visible =
    tab === 'healthy' ? healthy : tab === 'below' ? below : pools;
  const totalPages = Math.max(1, Math.ceil(visible.length / POOLS_PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const items = visible.slice(
    (current - 1) * POOLS_PAGE_SIZE,
    current * POOLS_PAGE_SIZE,
  );

  const tabs: Array<{ key: PoolTabKey; label: string; count: number }> = [
    { key: 'all', label: LBL.poolsTabAll, count: pools.length },
    { key: 'healthy', label: LBL.poolsTabHealthy, count: healthy.length },
    { key: 'below', label: LBL.poolsTabBelow, count: below.length },
  ];

  return (
    <Card>
      <CardContent className="panel-pad">
        {isPending ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        ) : failed ? (
          <SectionError onRetry={onRetry} />
        ) : pools.length === 0 ? (
          <p className="t-body rounded-lg border border-dashed px-4 py-6 text-center text-muted-foreground">
            {LBL.poolsEmpty}
          </p>
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-x-3">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                <h2 className="t-section-title">{LBL.poolsTitle}</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                  {tpl(LBL.poolsConfigured, { count: pools.length })}
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
                  {tabs.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      aria-pressed={tab === t.key}
                      onClick={() => {
                        setTab(t.key);
                        setPage(1);
                      }}
                      className={`whitespace-nowrap rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                        tab === t.key
                          ? 'border bg-background text-primary shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {`${t.label} (${t.count})`}
                    </button>
                  ))}
                </span>
              </div>
              {visible.length > 0 ? (
                <div className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-muted-foreground">
                  <span>
                    {tpl(LBL.poolsShowing, {
                      from: (current - 1) * POOLS_PAGE_SIZE + 1,
                      to: (current - 1) * POOLS_PAGE_SIZE + items.length,
                      total: visible.length,
                    })}
                  </span>
                  <span className="inline-flex items-center overflow-hidden rounded-lg border bg-background shadow-sm">
                    <button
                      type="button"
                      aria-label={LBL.prev}
                      disabled={current <= 1}
                      onClick={() => setPage(current - 1)}
                      className="border-r p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={LBL.next}
                      disabled={current >= totalPages}
                      onClick={() => setPage(current + 1)}
                      className="p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </span>
                </div>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {items.map((pool) => (
                <PoolCard key={pool.poolId} pool={pool} />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ================================================================== */
/* Transaction Volume & Flow                                             */
/* ================================================================== */

/** 图表卡：7D/14D/30D 切片（30 天一次拉取）+ Total/Avg/Peak + 柱状图。
 * refreshSeq 由页头 Refresh 递增驱动重拉（旧 refreshSeq 惯用法）。 */
function VolumeCard({ refreshSeq }: { refreshSeq: number }) {
  const query = useDashboardVolumeQuery(LP_PROJECT_ID, VOLUME_WINDOW_DAYS);
  const [range, setRange] = React.useState<number>(14);
  const refetch = query.refetch;

  React.useEffect(() => {
    if (refreshSeq > 0) void refetch();
  }, [refreshSeq, refetch]);

  /** 30 天 GMT+8 日切零填充 + 按日笔数求和（全状态，原型同口径）。 */
  const points30 = React.useMemo<VolumePoint[]>(() => {
    const byDay = new Map<string, number>();
    for (const row of query.data ?? []) {
      if (!row.day) continue;
      const n = Number(row.txCount);
      byDay.set(row.day, (byDay.get(row.day) ?? 0) + (Number.isFinite(n) ? n : 0));
    }
    return utc8Days(VOLUME_WINDOW_DAYS).map((day) => ({
      day,
      count: byDay.get(day) ?? 0,
    }));
  }, [query.data]);

  const points = points30.slice(-range);
  const total = points.reduce((sum, point) => sum + point.count, 0);
  const peak = points.reduce<VolumePoint | null>(
    (best, point) => (point.count > (best?.count ?? -1) ? point : best),
    null,
  );
  const avg =
    points.length > 0 ? Math.round((total / points.length) * 10) / 10 : 0;
  const failed = query.error != null && query.data == null;

  return (
    <Card className="h-full">
      <CardContent className="panel-pad flex h-full flex-col">
        <div className="mb-4 flex flex-col items-start justify-between gap-2.5 lg:flex-row lg:items-start lg:gap-x-3">
          <div className="min-w-0">
            <h2 className="t-section-title">{LBL.volumeTitle}</h2>
            <p className="t-supporting mt-0.5 text-muted-foreground">
              {tpl(LBL.volumeSub, { days: range })}
            </p>
          </div>
          <span
            role="group"
            aria-label={LBL.rangeGroup}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border bg-muted/40 p-1"
          >
            {VOLUME_RANGES.map((days) => (
              <button
                key={days}
                type="button"
                aria-pressed={range === days}
                onClick={() => setRange(days)}
                className={`rounded px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors ${
                  range === days
                    ? 'border bg-background text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {`${days}D`}
              </button>
            ))}
          </span>
        </div>

        {query.isPending ? (
          <Skeleton className="h-[280px] w-full" />
        ) : failed ? (
          <SectionError onRetry={() => void refetch()} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 pb-3 sm:grid-cols-3">
              <div className="min-w-0">
                <p className="t-supporting font-semibold text-muted-foreground">
                  {LBL.volumeTotal}
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums">{total}</p>
              </div>
              <div className="min-w-0">
                <p className="t-supporting font-semibold text-muted-foreground">
                  {LBL.volumeAvg}
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums">{avg}</p>
              </div>
              <div className="min-w-0">
                <p className="t-supporting flex min-w-0 items-center gap-1 font-semibold text-muted-foreground">
                  {LBL.volumePeak}
                  <InfoHint text={LBL.volumePeakInfo} />
                </p>
                <p className="mt-0.5 truncate text-lg font-bold tabular-nums text-primary">
                  {peak && peak.count > 0
                    ? `${shortDayLabel(peak.day)} · ${peak.count}`
                    : '-'}
                </p>
              </div>
            </div>
            {total === 0 ? (
              <VolumeChartEmpty message={LBL.volumeEmpty} />
            ) : (
              <VolumeBarChart points={points} />
            )}
            <div className="mt-3 flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-sm bg-primary"
              />
              {LBL.volumeLegend}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ================================================================== */
/* Revenue & Settlement（GAP-LP-01 静态补齐区，入口跳 /split-settle）      */
/* ================================================================== */

function RevenueSettlementPanel() {
  const cycle = nextCycleEndIso();
  const daysToCycle = daysUntil(cycle);
  return (
    <Card className="h-full">
      <CardContent className="panel-pad flex h-full flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="t-section-title">{LBL.revenueTitle}</h2>
          <Badge variant="success">{LBL.revenueBadge}</Badge>
        </div>

        <div>
          <p className="t-supporting text-muted-foreground">
            {LBL.revenueMyShare}
          </p>
          <p className="mt-1 text-3xl font-bold leading-none tracking-tight tabular-nums">
            <AmountWithToken
              value={REVENUE_SHARE_MTD_FALLBACK.amount}
              token={REVENUE_SHARE_MTD_FALLBACK.token}
            />
          </p>
          <p className="t-supporting mt-2 text-muted-foreground">
            {tpl(LBL.revenueNext, {
              date: shortDayLabel(cycle),
              count: daysToCycle ?? '-',
            })}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
          <div className="min-w-0">
            <p className="t-body font-semibold">{LBL.revenuePending}</p>
            <p className="t-supporting mt-0.5 text-muted-foreground">
              {LBL.revenuePendingSub}
            </p>
          </div>
          <span
            className={`t-data shrink-0 font-bold ${PENDING_CONFIRMATION_FALLBACK > 0 ? 'text-warning' : ''}`}
          >
            {PENDING_CONFIRMATION_FALLBACK}
          </span>
        </div>

        <div className="min-w-0">
          <p className="t-supporting font-semibold text-muted-foreground">
            {LBL.revenueByToken}
          </p>
          {SETTLEMENT_BY_TOKEN_FALLBACK.length === 0 ? (
            <p className="t-data mt-2 text-muted-foreground">-</p>
          ) : (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {SETTLEMENT_BY_TOKEN_FALLBACK.map((item) => (
                <div
                  key={item.token}
                  className="min-w-0 rounded-lg border bg-muted/30 px-2 py-2.5 text-center"
                >
                  <p className="truncate text-xs font-bold">{item.token}</p>
                  <p className="t-data mt-1 truncate font-bold">
                    {formatTokenAmount(item.myShare)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-2 border-t pt-4">
          <Button asChild variant="outline" className="w-full">
            <Link href="/split-settle">{LBL.revenueViewShare}</Link>
          </Button>
          <Button asChild className="w-full">
            <Link href="/split-settle">{LBL.revenueViewStatements}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
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
              tokens={`${symOf(r.sourceTokenCode)}/${symOf(r.targetTokenCode)}`}
              banks={`${bankOf(r.sourceTokenCode)} → ${bankOf(r.targetTokenCode)}`}
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
              tokens={`${symOf(r.sourceTokenCode)}/${symOf(r.targetTokenCode)}`}
              banks={`${bankOf(r.sourceTokenCode)} → ${bankOf(r.targetTokenCode)}`}
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
                {amountText(r.userDeduction, symOf(r.sourceTokenCode))}
              </span>
              <span className="text-muted-foreground">
                {` → ${amountText(r.receiverAmount, symOf(r.targetTokenCode))}`}
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
  const summaryQuery = useDashboardSummaryQuery(LP_PROJECT_ID);
  const poolQuery = usePoolListQuery(LP_PROJECT_ID);
  const pairQuery = usePairListQuery(LP_PROJECT_ID);
  const recentTxParams = React.useMemo<TxFlowListReq>(
    () => ({ pageNum: 1, pageSize: RECENT_TX_PAGE_SIZE, filter: {} }),
    [],
  );
  const txQuery = useTxFlowListQuery(LP_PROJECT_ID, recentTxParams);

  const [refreshSeq, setRefreshSeq] = React.useState(0);
  const [bannerDismissed, setBannerDismissed] = React.useState(false);

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

  /**
   * 告警横幅（GAP-LP-01 换算口径，真实行推导）：Active 池水位 ≤0 = 需补资；
   * Active 池预授权额度空/0 = 预授权缺失。无池数据不判 all-clear。
   */
  const { poolsRequireTopUp, preAuthMissing } = React.useMemo(() => {
    let topUp = 0;
    let preAuth = 0;
    for (const p of activePools) {
      const level = p.level == null || p.level === '' ? null : Number(p.level);
      if (level != null && Number.isFinite(level) && level <= 0) topUp += 1;
      const auth =
        p.preauthAuthAmount == null || p.preauthAuthAmount === ''
          ? null
          : Number(p.preauthAuthAmount);
      if (auth == null || !Number.isFinite(auth) || auth === 0) preAuth += 1;
    }
    return { poolsRequireTopUp: topUp, preAuthMissing: preAuth };
  }, [activePools]);
  const bannerWarn = poolsRequireTopUp > 0 || preAuthMissing > 0;

  /** KPI①：单 token 场景 BigInt 精确合计（跨 token → '-'，GAP-LP-01）。 */
  const balance = React.useMemo(() => {
    if (activePools.length === 0) {
      return {
        amount: null as string | null,
        token: null as string | null,
        poolCount: 0,
        tokenCount: 0,
      };
    }
    const tokenCount = new Set(activePools.map((p) => p.tokenCode)).size;
    if (tokenCount !== 1) {
      return {
        amount: TOTAL_POOL_BALANCE_MULTI_TOKEN,
        token: null,
        poolCount: activePools.length,
        tokenCount,
      };
    }
    return {
      amount: sumDecimalStrings(activePools.map((p) => p.availableBalanceCache)),
      token: activePools[0].tokenSymbol || activePools[0].tokenNo || null,
      poolCount: activePools.length,
      tokenCount,
    };
  }, [activePools]);

  const summaryFailed =
    summaryQuery.error != null && summaryQuery.data == null;
  const poolFailed = poolQuery.error != null && poolQuery.data == null;
  const pairFailed = pairQuery.error != null && pairQuery.data == null;
  const txFailed = txQuery.error != null && txQuery.data == null;

  /** As of = 页级四路查询最新 dataUpdatedAt（无数据 → 0 不显）。 */
  const asOf = Math.max(
    summaryQuery.dataUpdatedAt,
    poolQuery.dataUpdatedAt,
    pairQuery.dataUpdatedAt,
    txQuery.dataUpdatedAt,
  );

  const anyFetching =
    summaryQuery.isFetching ||
    poolQuery.isFetching ||
    pairQuery.isFetching ||
    txQuery.isFetching;

  function refreshAll() {
    setRefreshSeq((n) => n + 1);
    void summaryQuery.refetch();
    void poolQuery.refetch();
    void pairQuery.refetch();
    void txQuery.refetch();
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="section-gap flex flex-col">
        {/* ① 页头 */}
        <div className="flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <h1 className="t-page-title">{LBL.title}</h1>
            <p className="t-body mt-0.5 text-muted-foreground">
              {LBL.description}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {asOf > 0 ? (
              <span className="t-supporting whitespace-nowrap tabular-nums text-muted-foreground">
                {`${LBL.asOf} ${formatUtc8(asOf)} (UTC+8)`}
              </span>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={refreshAll}
              disabled={anyFetching}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${anyFetching ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {LBL.refresh}
            </Button>
          </div>
        </div>

        {/* ② 0024 降级条 + 告警横幅 */}
        {down ? <ServiceDownAlert traceId={down.traceId} /> : null}
        {!bannerDismissed && poolQuery.data != null ? (
          bannerWarn ? (
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <AlertTitle className="flex items-center gap-2">
                  {LBL.bannerWarn}
                  <button
                    type="button"
                    aria-label={LBL.dismiss}
                    onClick={() => setBannerDismissed(true)}
                    className="ml-auto rounded p-0.5 transition-colors hover:bg-warning/10"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </AlertTitle>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span
                    className={poolsRequireTopUp > 0 ? 'font-semibold' : ''}
                  >
                    {tpl(LBL.bannerTopUp, { count: poolsRequireTopUp })}
                  </span>
                  <span aria-hidden="true" className="opacity-60">
                    •
                  </span>
                  <span className={preAuthMissing > 0 ? 'font-semibold' : ''}>
                    {tpl(LBL.bannerPreAuth, { count: preAuthMissing })}
                  </span>
                </div>
              </div>
            </Alert>
          ) : (
            <Alert variant="success">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <AlertTitle className="flex items-center gap-2">
                  {LBL.bannerOk}
                  <button
                    type="button"
                    aria-label={LBL.dismiss}
                    onClick={() => setBannerDismissed(true)}
                    className="ml-auto rounded p-0.5 transition-colors hover:bg-success/10"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </AlertTitle>
                <p className="mt-1 text-sm">{LBL.bannerOkBody}</p>
              </div>
            </Alert>
          )
        ) : null}

        {/* ③ KPI 四宫格 */}
        {summaryQuery.isPending || poolQuery.isPending ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Coins}
              tone="primary"
              label={LBL.kpiBalance}
              info={LBL.kpiBalanceInfo}
              value={
                <AmountWithToken value={balance.amount} token={balance.token} />
              }
              footer={
                balance.poolCount > 0
                  ? tpl(LBL.kpiBalanceFoot, {
                      pools: balance.poolCount,
                      tokens: balance.tokenCount,
                    })
                  : null
              }
              failed={poolFailed}
              onRetry={() => void poolQuery.refetch()}
            />
            <StatCard
              icon={ArrowLeftRight}
              tone="info"
              label={LBL.kpiPairs}
              value={<span className="tabular-nums">{stats?.pairsActive ?? 0}</span>}
              footer={LBL.kpiPairsFoot}
              failed={summaryFailed}
              onRetry={() => void summaryQuery.refetch()}
            />
            <StatCard
              icon={Activity}
              tone="primary"
              label={LBL.kpiToday}
              info={LBL.kpiTodayInfo}
              value={<span className="tabular-nums">{stats?.txToday ?? 0}</span>}
              footer={LBL.kpiTodayFoot}
              failed={summaryFailed}
              onRetry={() => void summaryQuery.refetch()}
            />
            <StatCard
              icon={TrendingUp}
              tone="success"
              label={LBL.kpiMtd}
              info={LBL.kpiMtdInfo}
              value={
                <AmountWithToken
                  value={REVENUE_SHARE_MTD_FALLBACK.amount}
                  token={REVENUE_SHARE_MTD_FALLBACK.token}
                />
              }
              footer={tpl(LBL.kpiMtdFoot, {
                date: shortDayLabel(nextCycleEndIso()),
              })}
            />
          </div>
        )}

        {/* ④ My Liquidity Pools */}
        <PoolsSection
          pools={pools}
          isPending={poolQuery.isPending}
          failed={poolFailed}
          onRetry={() => void poolQuery.refetch()}
        />

        {/* ⑤ 图表 + 营收结算（8/4 分栏） */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <VolumeCard refreshSeq={refreshSeq} />
          </div>
          <div className="lg:col-span-4">
            <RevenueSettlementPanel />
          </div>
        </div>

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
