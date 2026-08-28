'use client';

/**
 * Dashboard 落地页（源 `src/views/dashboard/index.vue` v2.4 6c49396 口径，
 * lp:dashboard 登录首屏；v2.3 e591f85 引入，v2.4 修订）。
 *
 * 结构照源逐卡：统计卡四宫格（stats）→「My Pools」卡片列表（v2.4 池卡
 * 重构：bank+token tag 头 / tokenName / poolAddress 第三行 / 余额 / 水位
 * （含口径 tooltip）/ 授权可用额度 / foot 更新 balanceUpdateTime）→
 * 「Transaction Volume Statistics」自绘折线（v2.4 双维度：按汇率对 /
 * 按币种客户端重分组 + 7/14/30 天独立 useQuery 分 key）。
 * v2.4 最近交易表退役（成交量口径走折线图，交易流水入口取消）。
 *
 * 状态口径：池状态复用 pool 域码表（同后端码表同译文）。symOf 经
 * useTokenMeta（源端币种名即 token symbol）。色值不直写：水位条映射
 * tailwind 语义类。头部 Refresh 重拉 summary+volume（源 load 两请求）。
 */

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, CircleHelp, RefreshCw } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@myorg/shared/ui';

import {
  LP_PROJECT_ID,
  POOL_STATUS_TEXT,
  POOL_STATUS_VARIANT,
  useDashboardSummaryQuery,
  useDashboardVolumeQuery,
  useTokenMeta,
  type DashboardPoolCard,
} from '@myorg/modules/lp-portal/data-access';

import { formatMoney, formatTime } from './format';
import { VolumeChart, type VolumeSeries } from './volume-chart';

/* ================================================================== */
/* 文案与渲染辅助                                                        */
/* ================================================================== */

const LBL = {
  eyebrow: 'OVERVIEW',
  title: 'Dashboard',
  statPools: 'Pools Opened',
  statPoolsSub: 'pool records',
  statPairs: 'Active Token Pairs',
  statPairsSub: 'Token pairs I participate in',
  statToday: "Today's Transactions",
  statTodaySub: 'GMT+8 daily cutoff',
  statCompleted: 'Total Completed',
  statCompletedSub: 'Principal total',
  unitTx: 'tx',
  myPools: 'My Pools',
  balance: 'Balance',
  waterLevel: 'Water Level',
  /** v2.4 由「授权额度」更名（源 授权可用额度）。 */
  preauthAvailable: 'Pre-auth Available',
  waterLevelHelp: 'Balance ÷ token minimum liquidity (can exceed 100%)',
  updated: 'Updated',
  volumeTitle: 'Transaction Volume Statistics',
  volumeSub: 'Daily volume by token pair or currency',
  /** v2.4 维度 radio（切换不重拉，客户端重分组）。 */
  modePair: 'By Pair',
  modeCurrency: 'By Currency',
  /** currency 模式卡底右对齐注释（源端币种成交本金加总）。 */
  currencyNote: 'By currency: principal total grouped by source-side token',
  last7: 'Last 7 Days',
  last14: 'Last 14 Days',
  last30: 'Last 30 Days',
  emptyPools: 'No pools opened yet — head to Liquidity Pools to open your first one.',
  openPool: 'Open a Pool',
  unknownBank: 'Unknown Bank',
} as const;

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/** 水位文本：`(n*100).toFixed(0)%`；null → '-'（源 levelText 1:1）。 */
function levelText(level: string | null): string {
  if (level === null || level === '') return '-';
  return `${(Number(level) * 100).toFixed(0)}%`;
}

/** 水位条填充色：≥1 绿 / ≥0.5 橙 / else 红 / null 灰（源 1:1，语义类映射）。 */
function levelBarClass(level: string | null): string {
  if (level === null || level === '') return 'bg-gray-300';
  const n = Number(level);
  if (n >= 1) return 'bg-emerald-500';
  if (n >= 0.5) return 'bg-amber-500';
  return 'bg-red-500';
}

/** 等宽数值文本。 */
function Num({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs tabular-nums">{children}</span>;
}

/* ================================================================== */
/* 统计卡四宫格（stats 缺失显 '-'，源 v2.4 口径）                          */
/* ================================================================== */

interface StatCardProps {
  label: string;
  sub: string;
  value: string;
}

function StatCard({ label, sub, value }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

/* ================================================================== */
/* 我的资金池卡（v2.4 重构）                                             */
/* ================================================================== */

/**
 * 单池卡（源 pool-card v2.4：头=bank+tokenCode round plain tag+状态 tag；
 * 第二行 tokenName||'-'；**第三行 poolAddress||'-'（等宽截断+tooltip 原文）**；
 * 三行数据 余额/水位（进度条封顶 100 显示+口径 tooltip）/授权可用额度；
 * foot '更新 '+balanceUpdateTime falsy→'-'）。
 */
function PoolCard({ pool }: { pool: DashboardPoolCard }) {
  const statusText = POOL_STATUS_TEXT[pool.status] ?? String(pool.status);
  const statusVariant: BadgeVariant =
    POOL_STATUS_VARIANT[pool.status] ?? 'secondary';
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {pool.bankName || pool.bankCode || LBL.unknownBank}
            </span>
            <Badge
              variant="outline"
              className="rounded-full px-2 py-0 font-normal font-mono text-xs"
            >
              {pool.tokenCode}
            </Badge>
          </div>
          <Badge variant={statusVariant}>{statusText}</Badge>
        </div>
        <p className="mt-2 font-medium">{pool.tokenName || '-'}</p>
        {/* v2.4 第三行：池地址（货币系统账户）；空显 '-'，等宽截断+tooltip */}
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {pool.poolAddress || '-'}
            </p>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm break-all font-mono text-xs">
            {pool.poolAddress || '-'}
          </TooltipContent>
        </Tooltip>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">{LBL.balance}</dt>
            <dd>
              <Num>
                {pool.balance === null ? '-' : formatMoney(pool.balance)}
              </Num>
            </dd>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs">
              <dt className="flex items-center gap-1 text-muted-foreground">
                {LBL.waterLevel}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <CircleHelp
                      className="h-3.5 w-3.5 cursor-help text-muted-foreground/70"
                      aria-hidden="true"
                    />
                  </TooltipTrigger>
                  <TooltipContent>{LBL.waterLevelHelp}</TooltipContent>
                </Tooltip>
              </dt>
              <dd>
                <Num>{levelText(pool.level)}</Num>
              </dd>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${levelBarClass(pool.level)}`}
                style={{
                  width: `${Math.min(Number(pool.level ?? 0) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">{LBL.preauthAvailable}</dt>
            <dd>
              <Num>
                {pool.preauthAvailable === null
                  ? '-'
                  : formatMoney(pool.preauthAvailable)}
              </Num>
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          {LBL.updated}{' '}
          {pool.balanceUpdateTime ? formatTime(pool.balanceUpdateTime) : '-'}
        </p>
      </CardContent>
    </Card>
  );
}

/* ================================================================== */
/* 折线卡：维度 radio（pair/currency）+ 7/14/30 天 radio + VolumeChart    */
/* ================================================================== */

const DAY_OPTIONS = [7, 14, 30] as const;

type VolumeMode = 'pair' | 'currency';

/** 本地日切窗口（GMT+8 由后端聚合口径决定；前端仅生成日期序列名）。 */
function localDays(count: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - i,
    );
    const p = (n: number) => String(n).padStart(2, '0');
    out.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
  }
  return out;
}

/**
 * 折线卡（v2.4 双维度）：mode 切换**纯客户端重分组**（不重拉数据）；days
 * 切换重拉 `GET /dashboard/volume?days=N`；refreshSeq 由页头 Refresh 递增
 * 触发重拉（源 load = summary+volume 两请求）。
 */
function VolumeCard({ refreshSeq }: { refreshSeq: number }) {
  const [mode, setMode] = React.useState<VolumeMode>('pair');
  const [days, setDays] = React.useState<number>(7);
  const query = useDashboardVolumeQuery(LP_PROJECT_ID, days);
  const { symOf } = useTokenMeta(LP_PROJECT_ID);
  const window = React.useMemo(() => localDays(days), [days]);

  React.useEffect(() => {
    if (refreshSeq > 0) void query.refetch();
  }, [refreshSeq]);

  /**
   * 序列：pair 模式每 token 对一条 `SRC/TGT`（symOf 口径）；currency 模式
   * 按源端币种 symOf(sourceTokenCode) 成交本金加总一条；均按 name
   * localeCompare 降序截前 6。
   */
  const series = React.useMemo<VolumeSeries[]>(() => {
    const byKey = new Map<string, VolumeSeries>();
    for (const row of query.data ?? []) {
      const name =
        mode === 'pair'
          ? `${symOf(row.sourceTokenCode)}/${symOf(row.targetTokenCode)}`
          : symOf(row.sourceTokenCode);
      const cur = byKey.get(name) ?? { name, points: [] };
      cur.points.push({ day: row.day, v: Number(row.total) || 0 });
      byKey.set(name, cur);
    }
    return [...byKey.values()]
      .sort((a, b) => b.name.localeCompare(a.name))
      .slice(0, 6);
  }, [query.data, mode, symOf]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>{LBL.volumeTitle}</CardTitle>
          <CardDescription>{LBL.volumeSub}</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* 维度 radio：切换不重拉（客户端重分组） */}
          <div
            className="flex gap-1"
            role="radiogroup"
            aria-label={LBL.volumeTitle}
          >
            {(
              [
                ['pair', LBL.modePair],
                ['currency', LBL.modeCurrency],
              ] as const
            ).map(([m, text]) => (
              <Button
                key={m}
                size="sm"
                variant="outline"
                aria-pressed={mode === m}
                className={
                  mode === m ? 'border-primary text-primary' : undefined
                }
                onClick={() => setMode(m)}
              >
                {text}
              </Button>
            ))}
          </div>
          <div
            className="flex gap-1"
            role="radiogroup"
            aria-label={LBL.volumeTitle}
          >
            {DAY_OPTIONS.map((n) => (
              <Button
                key={n}
                size="sm"
                variant="outline"
                aria-pressed={days === n}
                className={
                  days === n ? 'border-primary text-primary' : undefined
                }
                onClick={() => setDays(n)}
              >
                {n === 7 ? LBL.last7 : n === 14 ? LBL.last14 : LBL.last30}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <VolumeChart days={window} series={series} />
        {/* currency 口径注释（卡底右对齐） */}
        {mode === 'currency' && (
          <p className="mt-2 text-right text-xs text-muted-foreground">
            {LBL.currencyNote}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ================================================================== */
/* 页面组装                                                              */
/* ================================================================== */

export function DashboardPage() {
  const query = useDashboardSummaryQuery(LP_PROJECT_ID);
  const data = query.data;
  const stats = data?.stats;
  /** 页头 Refresh 递增序号 → summary refetch + VolumeCard 重拉。 */
  const [refreshSeq, setRefreshSeq] = React.useState(0);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {LBL.eyebrow}
            </div>
            <h1 className="text-xl font-semibold">{LBL.title}</h1>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setRefreshSeq((n) => n + 1);
              void query.refetch();
            }}
            disabled={query.isFetching}
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${query.isFetching ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>

        {/* 统计卡四宫格（stats 缺失显 '-'） */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label={LBL.statPools}
            value={stats ? String(stats.poolsOpen) : '-'}
            sub={`${data?.pools.length ?? 0} ${LBL.statPoolsSub}`}
          />
          <StatCard
            label={LBL.statPairs}
            value={stats ? String(stats.pairsActive) : '-'}
            sub={LBL.statPairsSub}
          />
          <StatCard
            label={LBL.statToday}
            value={
              stats ? `${stats.txToday} ${LBL.unitTx}` : `- ${LBL.unitTx}`
            }
            sub={LBL.statTodaySub}
          />
          <StatCard
            label={LBL.statCompleted}
            value={
              stats
                ? `${stats.txCompleted} ${LBL.unitTx}`
                : `- ${LBL.unitTx}`
            }
            sub={`${LBL.statCompletedSub} ${formatMoney(stats?.principalTotal ?? 0)}`}
          />
        </div>

        {/* 我的资金池 */}
        <Card>
          <CardHeader>
            <CardTitle>{LBL.myPools}</CardTitle>
          </CardHeader>
          <CardContent>
            {data && data.pools.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-6 text-sm text-muted-foreground">
                <p>{LBL.emptyPools}</p>
                <Button asChild size="sm" variant="outline">
                  <Link href="/pool">
                    {LBL.openPool}
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {(data?.pools ?? []).map((p) => (
                  <PoolCard key={p.poolId} pool={p} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 成交量折线（v2.4 双维度） */}
        <VolumeCard refreshSeq={refreshSeq} />
      </div>
    </TooltipProvider>
  );
}
