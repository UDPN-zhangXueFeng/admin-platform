'use client';

/**
 * Dashboard 落地页（源 `src/views/dashboard/index.vue` v2.3 e591f85 1:1
 * 迁移，lp:dashboard 登录首屏）。
 *
 * 结构照源逐卡：统计卡四宫格（stats）→「My Pools」卡片列表（余额 / Water
 * Level 进度条封顶 100%、Pre-auth Available、foot 更新时间）→「Transaction
 * Volume Statistics」自绘折线（7/14/30 天 radio，独立 useQuery 分 key）→
 * 「Recent Transactions」7 列表。源两请求互不依赖、失败经拦截器统一提示，
 * 映射为两条独立 useQuery；头部 Refresh 仅重拉 summary（源 refreshBtn 语义）。
 *
 * 状态口径：池状态复用 pool 域码表（同后端码表同译文）；交易状态 tag 用
 * dashboard 独立口径 DASHBOARD_TX_STATUS_VARIANT（与 tx-flow 列表口径并存
 * 保真，01 §E21）。tokens 紧凑式（symOf 行 + bankOf→bankOf 行）经
 * useTokenMeta。色值不直写：水位条映射 tailwind 语义类。
 */

import * as React from 'react';
import Link from 'next/link';
import { type ColumnDef } from '@tanstack/react-table';
import { ArrowRight, RefreshCw } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataTable,
} from '@myorg/shared/ui';

import {
  DASHBOARD_TX_STATUS_VARIANT,
  LP_PROJECT_ID,
  POOL_STATUS_TEXT,
  POOL_STATUS_VARIANT,
  TX_STATUS_LABEL,
  useDashboardSummaryQuery,
  useDashboardVolumeQuery,
  useTokenMeta,
  type DashboardRecentTx,
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
  preauthAvailable: 'Pre-auth Available',
  updated: 'Updated',
  volumeTitle: 'Transaction Volume Statistics',
  volumeSub: 'Daily volume by token pair',
  last7: 'Last 7 Days',
  last14: 'Last 14 Days',
  last30: 'Last 30 Days',
  recent: 'Recent Transactions',
  emptyPools: 'No pools opened yet — head to Liquidity Pools to open your first one.',
  openPool: 'Open a Pool',
  emptyRecent: 'No transactions',
  viewTxFlow: 'View Transaction Flow',
  colTxNo: 'Tx No.',
  colTokenPair: 'Token Pair',
  colTokens: 'Tokens',
  colPrincipal: 'Principal',
  colReceiver: 'Receiver Amount',
  colStatus: 'Status',
  colCompleted: 'Completed Time',
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
/* 统计卡四宫格                                                          */
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
/* 我的资金池卡                                                          */
/* ================================================================== */

/** 单池卡（源 pool-card 1:1：余额 / 水位条封顶 100% / 预授权可用 / foot）。 */
function PoolCard({ pool }: { pool: DashboardPoolCard }) {
  const statusText = POOL_STATUS_TEXT[pool.status] ?? String(pool.status);
  const statusVariant: BadgeVariant =
    POOL_STATUS_VARIANT[pool.status] ?? 'secondary';
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium">{pool.tokenName || pool.tokenCode}</p>
            <p className="text-xs text-muted-foreground">
              {pool.bankName || pool.bankCode} · {pool.tokenCode}
            </p>
          </div>
          <Badge variant={statusVariant}>{statusText}</Badge>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{LBL.balance}</dt>
            <dd>
              <Num>
                {pool.balance === null ? '-' : formatMoney(pool.balance)}
              </Num>
            </dd>
          </div>
          <div className="flex justify-between gap-2">
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
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{LBL.waterLevel}</span>
            <span>{levelText(pool.level)}</span>
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
        <p className="mt-3 text-xs text-muted-foreground">
          {LBL.updated} {formatTime(pool.syncTime)}
        </p>
      </CardContent>
    </Card>
  );
}

/* ================================================================== */
/* 折线卡：7/14/30 天 radio + VolumeChart                                */
/* ================================================================== */

const DAY_OPTIONS = [7, 14, 30] as const;

/** 本地日切窗口（GMT+8 由后端聚合口径决定；前端仅生成日期序列名）。 */
function localDays(count: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const p = (n: number) => String(n).padStart(2, '0');
    out.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
  }
  return out;
}

function VolumeCard() {
  const [days, setDays] = React.useState<number>(7);
  const query = useDashboardVolumeQuery(LP_PROJECT_ID, days);
  const window = React.useMemo(() => localDays(days), [days]);

  /** 行 → 按 token 对序列：`SRC→TGT` 命名、localeCompare 降序截前 6。 */
  const series = React.useMemo<VolumeSeries[]>(() => {
    const byPair = new Map<string, VolumeSeries>();
    for (const row of query.data ?? []) {
      const name = `${row.sourceTokenCode}→${row.targetTokenCode}`;
      const cur = byPair.get(name) ?? { name, points: [] };
      cur.points.push({ day: row.day, v: Number(row.total) });
      byPair.set(name, cur);
    }
    return [...byPair.values()]
      .sort((a, b) => b.name.localeCompare(a.name))
      .slice(0, 6);
  }, [query.data]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>{LBL.volumeTitle}</CardTitle>
          <CardDescription>{LBL.volumeSub}</CardDescription>
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
      </CardHeader>
      <CardContent>
        <VolumeChart days={window} series={series} />
      </CardContent>
    </Card>
  );
}

/* ================================================================== */
/* 最近交易表                                                            */
/* ================================================================== */

/** DataTable 行标识：id:string 与 transactionId:number 撞名拆分承载。 */
type RecentRow = Omit<DashboardRecentTx, 'id' | 'transactionId'> & {
  id: string;
  transactionId: number;
};

function RecentTable() {
  const query = useDashboardSummaryQuery(LP_PROJECT_ID);
  const { symOf, bankOf } = useTokenMeta(LP_PROJECT_ID);

  const rows = React.useMemo<RecentRow[]>(
    () =>
      (query.data?.recentTxs ?? []).map((t) => ({
        ...t,
        id: String(t.transactionId),
      })),
    [query.data],
  );

  const columns = React.useMemo<ColumnDef<RecentRow>[]>(
    () => [
      {
        accessorFn: (r) => r.txNo || '-',
        id: 'txNo',
        header: LBL.colTxNo,
        cell: (c) => <Num>{c.getValue<string>()}</Num>,
      },
      {
        accessorFn: (r) => r.pairCode || '-',
        id: 'pairCode',
        header: LBL.colTokenPair,
      },
      {
        id: 'tokens',
        header: LBL.colTokens,
        cell: (c) => {
          const r = c.row.original;
          return (
            <div className="min-w-0">
              <p className="truncate font-mono text-xs font-semibold tabular-nums">
                {symOf(r.sourceTokenCode)}/{symOf(r.targetTokenCode)}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {bankOf(r.sourceTokenCode)} → {bankOf(r.targetTokenCode)}
              </p>
            </div>
          );
        },
      },
      {
        accessorFn: (r) => r.principal,
        id: 'principal',
        header: () => <div className="text-right">{LBL.colPrincipal}</div>,
        cell: (c) => (
          <div className="text-right">
            <Num>{formatMoney(c.row.original.principal)}</Num>
          </div>
        ),
      },
      {
        accessorFn: (r) => r.receiverAmount,
        id: 'receiverAmount',
        header: () => <div className="text-right">{LBL.colReceiver}</div>,
        cell: (c) => (
          <div className="text-right">
            <Num>{formatMoney(c.row.original.receiverAmount)}</Num>
          </div>
        ),
      },
      {
        accessorFn: (r) => r.status,
        id: 'status',
        header: LBL.colStatus,
        cell: (c) => {
          const r = c.row.original;
          const variant = DASHBOARD_TX_STATUS_VARIANT[r.status] ?? 'secondary';
          const text = TX_STATUS_LABEL[r.status] ?? String(r.status);
          return <Badge variant={variant as BadgeVariant}>{text}</Badge>;
        },
      },
      {
        accessorFn: (r) => r.completedTime,
        id: 'completedTime',
        header: LBL.colCompleted,
        cell: (c) =>
          c.row.original.completedTime === 0
            ? '-'
            : formatTime(c.row.original.completedTime),
      },
    ],
    [symOf, bankOf],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={query.isLoading}
      emptyMessage={LBL.emptyRecent}
    />
  );
}

/* ================================================================== */
/* 页面组装                                                              */
/* ================================================================== */

export function DashboardPage() {
  const query = useDashboardSummaryQuery(LP_PROJECT_ID);
  const data = query.data;
  const stats = data?.stats;

  return (
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
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw
            className={`mr-1.5 h-3.5 w-3.5 ${query.isFetching ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </div>

      {/* 统计卡四宫格 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={LBL.statPools}
          value={String(stats?.poolsOpen ?? 0)}
          sub={`${data?.pools.length ?? 0} ${LBL.statPoolsSub}`}
        />
        <StatCard
          label={LBL.statPairs}
          value={String(stats?.pairsActive ?? 0)}
          sub={LBL.statPairsSub}
        />
        <StatCard
          label={LBL.statToday}
          value={`${stats?.txToday ?? 0} ${LBL.unitTx}`}
          sub={LBL.statTodaySub}
        />
        <StatCard
          label={LBL.statCompleted}
          value={`${stats?.txCompleted ?? 0} ${LBL.unitTx}`}
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

      {/* 成交量折线 */}
      <VolumeCard />

      {/* 最近交易 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>{LBL.recent}</CardTitle>
          <Link
            href="/tx-flow"
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {LBL.viewTxFlow}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent>
          <RecentTable />
        </CardContent>
      </Card>
    </div>
  );
}
