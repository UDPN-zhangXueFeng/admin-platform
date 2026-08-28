'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import { Button, Card, CardContent, Skeleton } from '@myorg/shared/ui';
import { cn } from '@myorg/shared/util-classnames';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  KISSEN_PROJECT_ID,
  kissenPage,
} from '@myorg/modules/kissen-admin/data-access';

/**
 * DashboardPage —— 工作台「今日清算」总览（登录落点）。
 *
 * 迁移自 Vue 源 `views/workbench/index.vue`。聚合展示五块，数据全部来自现有
 * 列表接口，客户端聚合/过滤：
 * - 关键数字带：今日交易笔数 / 今日流水（按源币种分组，跨币种不混计） / 在途笔数 / 异常待处置
 * - 入网银行（status 20 生效 + 网关连通性 + 联系人）
 * - 资金池水位（token 维度，低于 remindThreshold 即告急）
 * - 异常待处置队列（status 70 前 5 笔）
 * - 对账差异（status 1 未处理条数）
 *
 * 五块各自独立 react-query 查询，任一接口失败只降级对应区块，不整页报错
 * （与源 Promise.all + 各 try/catch 同语义）。无独立 data-access 域：统计端点
 * 经 kissenPage 直接在本 feature 内薄调用（端点路径读自源 api/transaction.ts、
 * api/bank.ts、api/lp-pool.ts、api/reconcile.ts）。
 */

// ---- 行类型（最小子集，字段名与源 VO 对齐；只取工作台用到的） ----

interface WorkbenchTxRow {
  transactionId: number;
  txUuid: string;
  /** 交易单号 KSN+yyyyMMdd+6 位序号；存量未回填时为空串 */
  txNo: string;
  sourceCurrency: string;
  targetCurrency: string;
  /** TransactionStatusEnum：1/5/10/20/25/30/35/40/50/60/70/80/90 */
  status: number;
  principal: string | number;
  /** 用户扣款金额（今日流水客户端聚合口径） */
  userDeduction: string | number;
  createTime: number;
}

interface WorkbenchBankRow {
  bankId: number;
  bankName: string;
  bankCode: string;
  /** 联系人（v2.0 银行行展示字段，替代 v1.x 的币种/限额组） */
  contactName: string;
  /** 20 入网生效（客户端过滤口径） */
  status: number;
  /** 网关连通性：0 未知 / 1 正常 / 2 断开（未登记实例为 0） */
  connectivityStatus: number;
}

interface WorkbenchPoolRow {
  poolId: number;
  lpName: string;
  /** 池维度 token code（v2.0 资金池为 token 维度，不再有 currency） */
  tokenCode: string;
  /** 最低流动性（水位分母，token 维度） */
  minLiquidity: string | number;
  /** 补资提醒阈值（水位低于此比例即告急） */
  remindThreshold: string | number;
  availableBalanceCache: string | number;
}

// ---- 常量 ----

/** 在途状态：完成前的主线节点（已创建→已入账）。 */
const IN_FLIGHT: Record<number, true> = {
  1: true,
  5: true,
  10: true,
  20: true,
  25: true,
  30: true,
  35: true,
};

/** 交易状态映射（TransactionStatusEnum 13 值，与交易查询页一致）。 */
const TX_STATUS_MAP: Record<number, string> = {
  1: 'Created',
  5: 'Quoted',
  10: 'Confirmed',
  20: 'Source Transfer in Progress',
  25: 'Source Verified',
  30: 'Disbursing',
  35: 'Credited',
  40: 'Completed',
  50: 'Reversing',
  60: 'Reversed',
  70: 'Abnormal',
  80: 'Cancelled',
  90: 'Failed',
};

/** 异常队列网格列宽（源 .tx-head/.tx-row 同口径）。 */
const TX_GRID_COLS = '180px 90px 120px minmax(160px, 1fr) 155px 64px';

// ---- 格式化（移植自 views/approval/format.ts） ----

/** 数字千分位（保留原小数位）。 */
function formatMoney(v: number | string): string {
  const s = String(v);
  const [int, dec] = s.split('.');
  const sign = int.startsWith('-') ? '-' : '';
  const digits = sign ? int.slice(1) : int;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec === undefined ? `${sign}${grouped}` : `${sign}${grouped}.${dec}`;
}

/** 毫秒时间戳 → YYYY-MM-DD HH:mm:ss（手写，不引 dayjs）。 */
function formatTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(Number(ms))) return '-';
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return '-';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 今日 0 点毫秒（与对账页 dayStart 口径一致，运营环境 GMT+8）。 */
function dayStartMs(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** 货币对展示：源币→目标币，缺失占位。 */
function pairText(row: WorkbenchTxRow): string {
  return row.sourceCurrency && row.targetCurrency
    ? `${row.sourceCurrency}→${row.targetCurrency}`
    : '-';
}

// ---- 资金池水位（移植自 workbench index.vue） ----

/** 水位 = 可用余额 / 最低流动性（minLiquidity）；低于补资提醒阈值即告急（lp_pool FR-L-03 口径）。 */
function isPoolCritical(pool: WorkbenchPoolRow): boolean {
  const min = Number(pool.minLiquidity);
  if (!(min > 0)) return false; // 分母无效无法判断水位，按正常展示
  return Number(pool.availableBalanceCache) / min < Number(pool.remindThreshold);
}

/** 是否画水位条：最低流动性为正才有口径（分母口径同 isCritical）。 */
function hasPoolBar(pool: WorkbenchPoolRow): boolean {
  return Number(pool.minLiquidity) > 0;
}

/** 水位条宽度百分比（封顶 100，不低于 0 以免出现非法宽度）。 */
function poolBarWidth(pool: WorkbenchPoolRow): number {
  const min = Number(pool.minLiquidity);
  if (!(min > 0)) return 0;
  const ratio = Number(pool.availableBalanceCache) / min;
  return Math.max(0, Math.floor(Math.min(100, ratio * 100)));
}

/** 连通性色调：0 未知 / 1 正常 / 2 断开（口径同 api/bank.ts 注释）。 */
function connectivityTone(status: number): 'on' | 'off' | 'unknown' {
  if (status === 1) return 'on';
  if (status === 2) return 'off';
  return 'unknown';
}

const CONN_DOT: Record<'on' | 'off' | 'unknown', string> = {
  on: 'bg-emerald-500',
  off: 'bg-red-500',
  unknown: 'bg-muted-foreground/30',
};

// ---- 查询 key ----

const workbenchKeys = {
  all: (projectId: string) => ['project', projectId, 'workbench'] as const,
  today: (projectId: string) => [...workbenchKeys.all(projectId), 'today'] as const,
  banks: (projectId: string) => [...workbenchKeys.all(projectId), 'banks'] as const,
  exceptions: (projectId: string) =>
    [...workbenchKeys.all(projectId), 'exceptions'] as const,
  pools: (projectId: string) => [...workbenchKeys.all(projectId), 'pools'] as const,
  reconcile: (projectId: string) =>
    [...workbenchKeys.all(projectId), 'reconcile'] as const,
} as const;

// ---- 查询（薄调用，直接经 kissenPage 打真实端点） ----

/** 今日交易（客户端聚合笔数/流水/在途；pageSize 200 为今日切片上限）。 */
function useWorkbenchTodayQuery(projectId: string) {
  return useQuery({
    queryKey: workbenchKeys.today(projectId),
    queryFn: ({ signal }) =>
      kissenPage<WorkbenchTxRow>(
        '/manage/transaction/page',
        {
          pageNum: 1,
          pageSize: 200,
          filter: { createTimeStart: dayStartMs(), createTimeEnd: Date.now() },
        },
        { signal },
      ),
  });
}

/** 入网银行（全量切片后客户端过滤 status 20；pageSize 200 与今日切片上限同口径）。 */
function useWorkbenchBanksQuery(projectId: string) {
  return useQuery({
    queryKey: workbenchKeys.banks(projectId),
    queryFn: ({ signal }) =>
      kissenPage<WorkbenchBankRow>(
        '/manage/bank/list',
        { pageNum: 1, pageSize: 200, filter: {} },
        { signal },
      ),
  });
}

/** 异常待处置队列（status 70 前 5 笔）。 */
function useWorkbenchExceptionsQuery(projectId: string) {
  return useQuery({
    queryKey: workbenchKeys.exceptions(projectId),
    queryFn: ({ signal }) =>
      kissenPage<WorkbenchTxRow>(
        '/manage/transaction/page',
        { pageNum: 1, pageSize: 5, filter: { status: 70 } },
        { signal },
      ),
  });
}

/** 资金池水位（全量）。 */
function useWorkbenchPoolsQuery(projectId: string) {
  return useQuery({
    queryKey: workbenchKeys.pools(projectId),
    queryFn: ({ signal }) =>
      kissenPage<WorkbenchPoolRow>(
        '/manage/lp-pool/list',
        { pageNum: 1, pageSize: 200, filter: {} },
        { signal },
      ),
  });
}

/** 对账未处理差异（status 1；只取 total，pageSize 1）。 */
function useWorkbenchReconcileQuery(projectId: string) {
  return useQuery({
    queryKey: workbenchKeys.reconcile(projectId),
    queryFn: ({ signal }) =>
      kissenPage(
        '/manage/reconcile/diff/list',
        { pageNum: 1, pageSize: 1, filter: { status: 1 } },
        { signal },
      ),
  });
}

// ---- StatusRail（紧凑模式，移植自 components/StatusRail.vue） ----

/** 主线 8 节点：交易生命周期主路径。 */
const RAIL_MAIN = [1, 5, 10, 20, 25, 30, 35, 40] as const;
/** 结算腿节点（源端已验证→解付→入账）：钱真正移动的段。 */
const RAIL_SETTLE: Record<number, true> = { 25: true, 30: true, 35: true };
/**
 * 分支终态：forkCode 为交易离开主线前最后经过的主线节点（纯展示近似）。
 * 取消发生在钱未动之前，失败多在划转腿，冲正源自源端验证后，异常多在解付中。
 */
const RAIL_BRANCH: Record<number, { tone: 'danger' | 'info'; forkCode: number }> = {
  50: { tone: 'info', forkCode: 25 },
  60: { tone: 'info', forkCode: 25 },
  70: { tone: 'danger', forkCode: 30 },
  80: { tone: 'info', forkCode: 10 },
  90: { tone: 'danger', forkCode: 20 },
};

interface RailStep {
  key: string;
  state: 'done' | 'current' | 'todo';
  settle: boolean;
  tone?: 'danger' | 'info';
}

/** 由状态码推导渲染序列：主线画到当前位置/分叉点，分支终态末端追加一个节点。 */
function buildRailSteps(status: number): RailStep[] {
  const branch = RAIL_BRANCH[status];
  if (branch) {
    const forkIdx = RAIL_MAIN.findIndex((c) => c === branch.forkCode);
    return [
      ...RAIL_MAIN.slice(0, forkIdx + 1).map<RailStep>((c) => ({
        key: `m${c}`,
        state: 'done',
        settle: Boolean(RAIL_SETTLE[c]),
      })),
      { key: `b${status}`, state: 'current', settle: false, tone: branch.tone },
    ];
  }
  const curIdx = RAIL_MAIN.findIndex((c) => c === status);
  return RAIL_MAIN.map<RailStep>((c, i) => ({
    key: `m${c}`,
    state: i < curIdx ? 'done' : i === curIdx ? 'current' : 'todo',
    settle: Boolean(RAIL_SETTLE[c]),
  }));
}

/** 圆点样式：主线清算蓝、结算腿结算金、分支终态 danger 红 / info 灰。 */
function railDotClass(s: RailStep): string {
  if (s.tone === 'danger')
    return 'bg-red-500 border-red-500 shadow-[0_0_0_3px_rgba(220,38,38,0.2)]';
  if (s.tone === 'info')
    return 'bg-slate-400 border-slate-400 shadow-[0_0_0_3px_rgba(100,116,139,0.2)]';
  if (s.state === 'current')
    return cn(
      'shadow-[0_0_0_3px_rgba(11,107,83,0.2)]',
      s.settle ? 'bg-amber-600 border-amber-600' : 'bg-teal-700 border-teal-700',
    );
  if (s.state === 'done')
    return s.settle ? 'bg-amber-600 border-amber-600' : 'bg-teal-700 border-teal-700';
  return s.settle ? 'border-amber-600' : 'border-muted-foreground/40';
}

/** 连线样式：跟随下一节点的色调，未到达灰。 */
function railLinkClass(next: RailStep): string {
  if (next.tone === 'danger') return 'bg-red-500';
  if (next.tone === 'info') return 'bg-slate-400';
  if (next.state === 'todo') return 'bg-muted-foreground/30';
  return 'bg-teal-700';
}

/** 紧凑状态轨道：横向节点（8px 圆点）加连线，无标签（列表行内嵌）。 */
function StatusRailCompact({ status }: { status: number }) {
  const steps = React.useMemo(() => buildRailSteps(status), [status]);
  return (
    <div
      className="flex items-start overflow-x-auto"
      role="img"
      aria-label={`Transaction status: ${TX_STATUS_MAP[status] ?? 'Unknown'}`}
    >
      {steps.map((s, i) => (
        <React.Fragment key={s.key}>
          <span
            className={cn(
              'mt-px h-2 w-2 shrink-0 rounded-full border-[1.5px] box-border',
              railDotClass(s),
            )}
          />
          {i < steps.length - 1 && (
            <span
              className={cn(
                'mt-[3px] h-0.5 min-w-[12px] flex-1 rounded-sm',
                railLinkClass(steps[i + 1]!),
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ---- 通用展示小块 ----

function FigureCell({
  label,
  children,
  divider,
}: {
  label: string;
  children: React.ReactNode;
  divider?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2',
        divider && 'md:border-l md:border-border md:px-6',
      )}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold leading-tight tabular-nums">
        {children}
      </div>
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  extra,
}: {
  eyebrow: string;
  title: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-baseline gap-2.5">
      <span className="text-xs text-muted-foreground">{eyebrow}</span>
      <span className="text-sm font-semibold">{title}</span>
      {extra !== undefined && (
        <span className="ml-auto text-xs text-muted-foreground">{extra}</span>
      )}
    </div>
  );
}

function BlockFail({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
      <span>Failed to load. Refresh to retry.</span>
      {onRetry && (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={onRetry}
        >
          Retry
        </Button>
      )}
    </div>
  );
}

function BlockSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
    </div>
  );
}

// ---- 图标（内联 SVG，不引新依赖） ----

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

// ---- 页面 ----

export function DashboardPage() {
  const router = useRouter();

  const todayQ = useWorkbenchTodayQuery(KISSEN_PROJECT_ID);
  const banksQ = useWorkbenchBanksQuery(KISSEN_PROJECT_ID);
  const exceptionsQ = useWorkbenchExceptionsQuery(KISSEN_PROJECT_ID);
  const poolsQ = useWorkbenchPoolsQuery(KISSEN_PROJECT_ID);
  const reconcileQ = useWorkbenchReconcileQuery(KISSEN_PROJECT_ID);

  const refreshing =
    todayQ.isFetching ||
    banksQ.isFetching ||
    exceptionsQ.isFetching ||
    poolsQ.isFetching ||
    reconcileQ.isFetching;

  const handleRefresh = React.useCallback(() => {
    void Promise.all([
      todayQ.refetch(),
      banksQ.refetch(),
      exceptionsQ.refetch(),
      poolsQ.refetch(),
      reconcileQ.refetch(),
    ]);
  }, [todayQ, banksQ, exceptionsQ, poolsQ, reconcileQ]);

  // 今日概览（客户端聚合）
  const todayRows = todayQ.data?.data ?? [];
  const todayCount = todayRows.length;
  // 今日流水按源币种分组逐币种加总（userDeduction 属源币种金额，跨币种不可混计，
  // 2026-08-27 用户反馈口径同上游）；按金额降序，空组显示占位符。
  const todayVolumes = React.useMemo(() => {
    const byCcy = new Map<string, number>();
    for (const r of todayRows) {
      const ccy = r.sourceCurrency || '-';
      byCcy.set(ccy, (byCcy.get(ccy) ?? 0) + (Number(r.userDeduction) || 0));
    }
    return [...byCcy.entries()]
      .map(([ccy, total]) => ({ ccy, total }))
      .sort((a, b) => b.total - a.total);
  }, [todayRows]);
  const inflightCount = todayRows.filter((r) => Boolean(IN_FLIGHT[r.status])).length;
  const todayVolumeText = todayVolumes.length
    ? todayVolumes
        .map((v) => `${v.ccy} ${formatMoney(Number(v.total.toFixed(2)))}`)
        .join(' · ')
    : '-';

  // 入网银行（客户端过滤 status 20）
  const banks = (banksQ.data?.data ?? []).filter((b) => b.status === 20);

  // 异常队列
  const exceptionRows = exceptionsQ.data?.data ?? [];
  const exceptionTotal = exceptionsQ.data?.pagination.total ?? 0;

  // 资金池
  const pools = poolsQ.data?.data ?? [];

  // 对账未处理差异
  const diffPending = reconcileQ.data?.pagination.total ?? 0;

  return (
    <div className="flex flex-col gap-4">
      {/* 页头 */}
      <header className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">DAILY CLEARING</div>
          <h1 className="text-xl font-semibold">Today's Clearing</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshIcon className={cn(refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </header>

      {/* 关键数字带：今日概览三格 + 异常待处置一格，各自独立降级 */}
      <Card>
        <CardContent className="py-6">
          <div className="grid grid-cols-2 items-center gap-6 md:grid-cols-4 md:gap-0">
            {todayQ.isError ? (
              <div className="col-span-2 py-1 text-sm text-muted-foreground md:col-span-3">
                Failed to load. Refresh to retry.
              </div>
            ) : todayQ.isLoading ? (
              <>
                <FigureCell label="Today's Transactions">
                  <Skeleton className="h-7 w-20" />
                </FigureCell>
                <FigureCell label="Today's Volume by Currency" divider>
                  <Skeleton className="h-7 w-32" />
                </FigureCell>
                <FigureCell label="In-Flight Count" divider>
                  <Skeleton className="h-7 w-16" />
                </FigureCell>
              </>
            ) : (
              <>
                <FigureCell label="Today's Transactions">
                  {formatMoney(todayCount)}
                </FigureCell>
                <FigureCell label="Today's Volume by Currency" divider>
                  {todayVolumeText}
                </FigureCell>
                <FigureCell label="In-Flight Count" divider>
                  {formatMoney(inflightCount)}
                </FigureCell>
              </>
            )}
            {/* 异常待处置（独立降级，与今日概览解耦） */}
            <FigureCell label="Pending Exceptions" divider>
              {exceptionsQ.isError ? (
                <span className="text-sm font-normal text-muted-foreground">
                  Failed to load. Refresh to retry.
                </span>
              ) : exceptionsQ.isLoading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <span className={exceptionTotal > 0 ? 'text-destructive' : undefined}>
                  {formatMoney(exceptionTotal)}
                </span>
              )}
            </FigureCell>
          </div>
        </CardContent>
      </Card>

      {/* 分块网格：上排网络状态（入网银行 / 资金池水位），下排待办（异常队列 / 对账差异） */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        {/* 入网银行 */}
        <Card>
          <CardContent className="py-6">
            <SectionHead
              eyebrow="NETWORK"
              title="Onboarded Banks"
              extra={
                !banksQ.isLoading && !banksQ.isError
                  ? `Total ${banks.length}`
                  : undefined
              }
            />
            {banksQ.isError ? (
              <BlockFail onRetry={() => banksQ.refetch()} />
            ) : banksQ.isLoading ? (
              <BlockSkeleton rows={3} />
            ) : banks.length === 0 ? (
              <span className="text-sm text-muted-foreground">No onboarded banks</span>
            ) : (
              <div>
                {banks.map((bank) => (
                  <div
                    key={bank.bankId}
                    className="flex items-center gap-2.5 border-b border-border py-2.5 text-sm last:border-0"
                  >
                    <span
                      className={cn(
                        'h-2 w-2 shrink-0 rounded-full',
                        CONN_DOT[connectivityTone(bank.connectivityStatus)],
                      )}
                    />
                    <span className="font-medium">{bank.bankName}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {bank.bankCode}
                    </span>
                    {/* v2.0 银行行：联系人取代 v1.x 币种徽标与单笔/日限额组 */}
                    <span className="text-xs text-muted-foreground">
                      {bank.contactName || '-'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 资金池水位 */}
        <Card>
          <CardContent className="py-6">
            <SectionHead eyebrow="POOL LEVEL" title="Funding Pool Level" />
            {poolsQ.isError ? (
              <BlockFail onRetry={() => poolsQ.refetch()} />
            ) : poolsQ.isLoading ? (
              <BlockSkeleton rows={3} />
            ) : pools.length === 0 ? (
              <span className="text-sm text-muted-foreground">No funding pools</span>
            ) : (
              <div>
                {pools.map((pool) => {
                  const critical = isPoolCritical(pool);
                  return (
                    <div
                      key={pool.poolId}
                      className="flex flex-col gap-1.5 border-b border-border py-2.5 text-sm last:border-0"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            'h-2 w-2 shrink-0 rounded-full',
                            critical ? 'bg-amber-500' : 'bg-emerald-500',
                          )}
                        />
                        <span className="font-medium">{pool.tokenCode}</span>
                        <span className="text-xs text-muted-foreground">
                          {pool.lpName || '-'}
                        </span>
                        <span className="ml-auto tabular-nums">
                          {formatMoney(pool.availableBalanceCache)}
                        </span>
                        {critical && (
                          <span className="text-xs font-medium text-amber-600">
                            Critical
                          </span>
                        )}
                      </div>
                      {hasPoolBar(pool) && (
                        <div className="h-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              critical ? 'bg-amber-500' : 'bg-emerald-500',
                            )}
                            style={{ width: `${poolBarWidth(pool)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 异常待处置队列 */}
        <Card>
          <CardContent className="py-6">
            <SectionHead
              eyebrow="EXCEPTION QUEUE"
              title="Pending Exceptions"
              extra={
                !exceptionsQ.isLoading &&
                !exceptionsQ.isError &&
                exceptionTotal > exceptionRows.length
                  ? `Total ${exceptionTotal}, showing first ${exceptionRows.length}`
                  : undefined
              }
            />
            {exceptionsQ.isError ? (
              <BlockFail onRetry={() => exceptionsQ.refetch()} />
            ) : exceptionsQ.isLoading ? (
              <BlockSkeleton rows={3} />
            ) : exceptionRows.length === 0 ? (
              <div className="flex items-center gap-1.5 py-1 text-sm text-muted-foreground">
                <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                No exceptions to handle
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div
                  className="grid items-center gap-3 border-b border-border pb-1.5 text-xs text-muted-foreground"
                  style={{ gridTemplateColumns: TX_GRID_COLS }}
                >
                  <span>Txn No.</span>
                  <span>Currency Pair</span>
                  <span>Principal</span>
                  <span>Status</span>
                  <span>Created At</span>
                  <span />
                </div>
                {exceptionRows.map((row) => (
                  <div
                    key={row.transactionId}
                    className="grid items-center gap-3 border-b border-border py-3 text-sm last:border-0"
                    style={{ gridTemplateColumns: TX_GRID_COLS }}
                  >
                    <span className="tabular-nums">
                      {row.txNo || row.txUuid}
                    </span>
                    <span>{pairText(row)}</span>
                    <span className="tabular-nums">
                      {formatMoney(row.principal)}
                    </span>
                    <StatusRailCompact status={row.status} />
                    <span className="tabular-nums text-muted-foreground">
                      {formatTime(row.createTime)}
                    </span>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      onClick={() => router.push('/transfer/tx')}
                    >
                      Resolve
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 对账差异 */}
        <Card>
          <CardContent className="py-6">
            <SectionHead eyebrow="RECONCILIATION" title="Reconciliation Differences" />
            {reconcileQ.isError ? (
              <BlockFail onRetry={() => reconcileQ.refetch()} />
            ) : reconcileQ.isLoading ? (
              <BlockSkeleton rows={1} />
            ) : diffPending > 0 ? (
              <div className="flex items-center gap-3 text-sm">
                <span>
                  <span className="tabular-nums">{diffPending}</span> unresolved difference(s)
                </span>
                {/* v2.0 对账差异页已下线（§G：删页面+菜单，api 保留）；卡片保留计数，不设跳转。 */}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">
                No unresolved differences
              </span>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
