'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy, Info } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useToast,
} from '@myorg/shared/ui';
import { cn } from '@myorg/shared/util-classnames';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  KISSEN_PROJECT_ID,
  kissenPage,
  useInstanceListQuery,
  useLpListQuery,
  useSettleOrderListQuery,
  useTokenListQuery,
  useTokenPairListQuery,
} from '@myorg/modules/kissen-admin/data-access';

/**
 * DashboardPage —— 工作台「今日清算」总览（登录落点）。
 *
 * 迁移自 Vue 源 `views/workbench/index.vue`，并参考 `udpn-kissen` 重组为：
 * 页头、四张 KPI 卡片、异常队列/结算摘要、资金池概览/网络概览。数据全部来自现有
 * 列表接口，客户端只做展示所需的聚合/过滤：
 * - KPI：今日交易笔数 / 今日流水（按源币种分组） / 在途笔数 / 异常待处置
 * - 异常队列（status 70 前 5 笔）与结算状态（pending/confirmed/settled）
 * - 资金池水位（token 维度，低于 remindThreshold 即告急）
 * - 网络概览（银行、网关实例、流动性提供方、Token Pairs）
 *
 * 各区块各自独立 react-query 查询，任一接口失败只降级对应区块，不整页报错
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
  tokenId: number;
  lpName: string;
  accountAddress?: string;
  /** 池维度 token code（v2.0 资金池为 token 维度，不再有 currency） */
  tokenCode: string;
  /** 最低流动性（水位分母，token 维度） */
  minLiquidity: string | number;
  /** 补资提醒阈值（水位低于此比例即告急） */
  remindThreshold: string | number;
  availableBalanceCache: string | number;
  preauthAvailable: string | number | null;
  status: number;
}

// ---- 常量 ----

/** 在途状态：完成前的主线节点（35 已是成功终态，2026-09-04 与上游对齐剔除）。 */
const IN_FLIGHT: Record<number, true> = {
  1: true,
  5: true,
  10: true,
  20: true,
  25: true,
  30: true,
};

/** 交易状态映射（TransactionStatusEnum 13 值，与交易查询页一致）。 */
const TX_STATUS_MAP: Record<number, string> = {
  1: 'Created',
  5: 'Quoted',
  10: 'Confirmed',
  20: 'Source Transfer in Progress',
  25: 'Source Verified',
  30: 'Disbursing',
  35: 'Completed',
  40: 'Completed',
  50: 'Reversing',
  60: 'Reversed',
  70: 'Abnormal',
  80: 'Cancelled',
  90: 'Failed',
};

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

/** 时间戳 → 适合异常队列表格的相对时长。 */
function formatAge(ms: number): string {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (elapsedMinutes < 60) return `${elapsedMinutes}m`;
  const hours = Math.floor(elapsedMinutes / 60);
  return `${hours}h ${elapsedMinutes % 60}m`;
}

/** 地址保留首尾片段，避免破坏参考布局的表格密度。 */
function formatAddress(address: string | undefined): string {
  if (!address) return '-';
  return address.length > 14
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address;
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
  return (
    Number(pool.availableBalanceCache) / min < Number(pool.remindThreshold)
  );
}

/** 水位条宽度百分比（封顶 100，不低于 0 以免出现非法宽度）。 */
function poolBarWidth(pool: WorkbenchPoolRow): number {
  const min = Number(pool.minLiquidity);
  if (!(min > 0)) return 0;
  const ratio = Number(pool.availableBalanceCache) / min;
  return Math.max(0, Math.floor(Math.min(100, ratio * 100)));
}

// ---- 查询 key ----

const workbenchKeys = {
  all: (projectId: string) => ['project', projectId, 'workbench'] as const,
  today: (projectId: string) =>
    [...workbenchKeys.all(projectId), 'today'] as const,
  banks: (projectId: string) =>
    [...workbenchKeys.all(projectId), 'banks'] as const,
  exceptions: (projectId: string) =>
    [...workbenchKeys.all(projectId), 'exceptions'] as const,
  pools: (projectId: string) =>
    [...workbenchKeys.all(projectId), 'pools'] as const,
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

// ---- 通用展示小块 ----

function MetricLabel({ label, tooltip }: { label: string; tooltip?: string }) {
  return (
    <div className="flex items-center gap-1 text-xs font-semibold tracking-wide text-muted-foreground">
      <span>{label}</span>
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              aria-label={`More information about ${label}`}
              className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground"
              tabIndex={0}
            >
              <Info className="h-3 w-3" aria-hidden="true" />
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-64 text-xs leading-relaxed">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}

/** Compact copy action used by dense dashboard tables. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const toast = useToast();

  const handleCopy = React.useCallback(() => {
    const copyWithTextarea = (): boolean => {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      try {
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, value.length);
        return document.execCommand('copy');
      } catch {
        return false;
      } finally {
        textarea.remove();
      }
    };

    const notifyResult = (copied: boolean) => {
      if (copied) {
        toast.success('Copied');
      } else {
        toast.error('Copy failed');
      }
    };

    if (!window.isSecureContext || !navigator.clipboard) {
      notifyResult(copyWithTextarea());
      return;
    }

    void navigator.clipboard.writeText(value).then(
      () => notifyResult(true),
      () => notifyResult(copyWithTextarea()),
    );
  }, [toast, value]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="iconSm"
      className="h-6 w-6 text-muted-foreground"
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
      onClick={() => void handleCopy()}
    >
      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
    </Button>
  );
}

function MetricCard({
  label,
  tooltip,
  value,
  footer,
  badge,
  className,
  valueClassName,
}: {
  label: string;
  tooltip?: string;
  value: React.ReactNode;
  footer?: React.ReactNode;
  badge?: { label: string; variant: 'destructive' | 'mute' | 'success' };
  className?: string;
  valueClassName?: string;
}) {
  return (
    <Card
      className={cn(
        'rounded-[10px] p-4 transition-colors hover:border-primary',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <MetricLabel label={label} tooltip={tooltip} />
        {badge ? (
          <Badge variant={badge.variant} size="sm">
            {badge.label}
          </Badge>
        ) : null}
      </div>
      <div
        className={cn(
          'mt-1.5 text-3xl font-bold tracking-tight tabular-nums',
          valueClassName,
        )}
      >
        {value}
      </div>
      {footer ? (
        <div className="mt-1 text-xs font-medium text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </Card>
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
    <div className="mb-3.5 flex items-baseline justify-between gap-3">
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

function StatLine({
  label,
  count,
  variant,
  hint,
}: {
  label: string;
  count: number | null;
  variant: 'warning' | 'mute' | 'success';
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0">
      <span className="flex min-w-0 items-center gap-2 font-medium">
        <Badge variant={variant} size="sm">
          {label}
        </Badge>
        {hint ? (
          <span className="truncate text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </span>
      <span className="shrink-0 font-bold tabular-nums">
        {count == null ? '—' : count}{' '}
        <span className="text-xs font-medium text-muted-foreground">
          {count === 1 ? 'statement' : 'statements'}
        </span>
      </span>
    </div>
  );
}

function NetworkStat({
  name,
  count,
  hint,
}: {
  name: string;
  count: number | null;
  hint: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0 flex-1 font-semibold">
        {name}
        <span className="mt-px block truncate text-xs font-medium text-muted-foreground">
          {hint}
        </span>
      </div>
      <div className="shrink-0 text-right text-xl font-bold whitespace-nowrap">
        {count == null ? '—' : count}{' '}
        <span className="text-xs font-medium text-muted-foreground">
          active
        </span>
      </div>
    </div>
  );
}

function PoolLevel({ pool }: { pool: WorkbenchPoolRow }) {
  const critical = isPoolCritical(pool);
  const minLiquidity = Number(pool.minLiquidity);
  const availableBalance = Number(pool.availableBalanceCache);
  const hasCalculation =
    Number.isFinite(availableBalance) &&
    Number.isFinite(minLiquidity) &&
    minLiquidity > 0;
  const percentage = hasCalculation
    ? Math.round((availableBalance / minLiquidity) * 100)
    : null;
  const alertThreshold = Number(pool.remindThreshold);
  const alertThresholdText = Number.isFinite(alertThreshold)
    ? `${Math.round(alertThreshold * 100)}%`
    : '—';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex min-w-[220px] cursor-help items-center gap-2.5">
          <div className="relative h-1.5 w-[110px] rounded bg-muted">
            {percentage != null ? (
              <div
                className={cn(
                  'absolute inset-y-0 left-0 rounded',
                  critical ? 'bg-warning' : 'bg-success',
                )}
                style={{ width: `${poolBarWidth(pool)}%` }}
              />
            ) : null}
            {percentage != null ? (
              <div className="absolute inset-y-[-3px] left-[45%] w-0.5 bg-muted-foreground/50" />
            ) : null}
          </div>
          <span className="w-12 text-xs tabular-nums text-muted-foreground">
            {percentage == null ? '—' : `${percentage}%`}
          </span>
          <Badge variant={critical ? 'destructive' : 'success'} size="sm">
            {critical ? 'Low' : 'Sufficient'}
          </Badge>
        </div>
      </TooltipTrigger>
      <TooltipContent className="text-xs">
        {hasCalculation ? (
          <div>
            {formatMoney(availableBalance.toFixed(2))} ÷{' '}
            {formatMoney(minLiquidity.toFixed(2))} = {percentage}%
          </div>
        ) : (
          <div>Pool level unavailable</div>
        )}
        <div>Alert threshold: {alertThresholdText}</div>
      </TooltipContent>
    </Tooltip>
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
  return (
    <Card className="h-full rounded-[10px] p-5">
      <PanelHeading
        title="Pool Overview"
        action={`All pools ${pools.length} →`}
        onAction={onViewAll}
      />
      {isError ? (
        <BlockFail onRetry={onRetry} />
      ) : isLoading ? (
        <BlockSkeleton rows={4} />
      ) : pools.length === 0 ? (
        <BlockEmpty
          icon={<InboxIcon className="h-4 w-4" />}
          text="No pools yet"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr>
                {[
                  'LP',
                  'Pool Address',
                  'Available Pre-Authorized',
                  'Token',
                  'Available Balance',
                  'Pool Level',
                ].map((heading, index) => (
                  <th
                    key={heading}
                    className={cn(
                      'whitespace-nowrap border-b border-border px-3 py-2 text-left text-xs font-semibold tracking-wide text-muted-foreground',
                      (index === 2 || index === 4) && 'text-right',
                    )}
                  >
                    {heading === 'Pool Level' ? (
                      <span className="inline-flex items-center gap-1">
                        {heading}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              aria-label="Pool level calculation"
                              className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground"
                              tabIndex={0}
                            >
                              <Info className="h-3 w-3" aria-hidden="true" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">
                            <div>
                              Pool Level = Available Balance ÷ Min. Liquidity
                            </div>
                            <div>Alert threshold: 20%</div>
                          </TooltipContent>
                        </Tooltip>
                      </span>
                    ) : (
                      heading
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pools.map((pool) => {
                return (
                  <tr key={pool.poolId} className="hover:bg-muted/40">
                    <td className="border-b border-border px-3 py-2.5 text-sm">
                      {pool.lpName || '-'}
                    </td>
                    <td className="border-b border-border px-3 py-2.5 font-mono text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        {formatAddress(pool.accountAddress)}
                        {pool.accountAddress ? (
                          <CopyButton
                            value={pool.accountAddress}
                            label="pool address"
                          />
                        ) : null}
                      </span>
                    </td>
                    <td className="border-b border-border px-3 py-2.5 text-right text-sm tabular-nums">
                      {pool.preauthAvailable == null
                        ? '-'
                        : formatMoney(pool.preauthAvailable)}
                    </td>
                    <td className="border-b border-border px-3 py-2.5 text-sm font-semibold">
                      {tokenNames.get(pool.tokenId) || pool.tokenCode || '-'}
                    </td>
                    <td className="border-b border-border px-3 py-2.5 text-right text-sm tabular-nums">
                      {formatMoney(pool.availableBalanceCache)}
                    </td>
                    <td className="border-b border-border px-3 py-2.5">
                      <PoolLevel pool={pool} />
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

function SettlementOverview({
  settleQuery,
  reconcileQuery,
  onViewAll,
}: {
  settleQuery: ReturnType<typeof useSettleOrderListQuery>;
  reconcileQuery: ReturnType<typeof useWorkbenchReconcileQuery>;
  onViewAll: () => void;
}) {
  const rows = settleQuery.data?.data ?? [];
  const settledSince = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const countByStatus = (status: number, since?: number) =>
    rows.filter(
      (row) =>
        row.status === status && (since == null || row.createTime >= since),
    ).length;
  const diffPending = reconcileQuery.data?.pagination.total ?? 0;

  return (
    <Card className="h-full rounded-[10px] p-5">
      <PanelHeading
        title="Settlement Statements"
        action="View all →"
        onAction={onViewAll}
      />
      {settleQuery.isError ? (
        <BlockFail onRetry={() => settleQuery.refetch()} />
      ) : settleQuery.isLoading ? (
        <BlockSkeleton rows={3} />
      ) : (
        <>
          <StatLine
            label="Pending Approval"
            count={countByStatus(10)}
            variant="warning"
          />
          <StatLine
            label="Confirmed"
            count={countByStatus(20)}
            variant="mute"
          />
          <StatLine
            label="Settled"
            count={countByStatus(35, settledSince)}
            variant="success"
            hint="last 7 days"
          />
        </>
      )}
      <div
        className={cn(
          'mt-3.5 flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-xs font-semibold',
          reconcileQuery.isError || diffPending > 0
            ? 'border-warning/30 bg-warning/10 text-warning'
            : 'border-success/30 bg-success/10 text-success',
        )}
      >
        <span aria-hidden="true">
          {reconcileQuery.isError || diffPending > 0 ? '!' : '✓'}
        </span>
        <span>
          {reconcileQuery.isError
            ? 'Reconciliation status unavailable'
            : diffPending > 0
              ? `${diffPending} unresolved reconciliation difference(s)`
              : 'Reconciliation — no unresolved differences'}
        </span>
      </div>
    </Card>
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

/** 区块空态：图标 + muted 文案（通用规则 2 的统一形态）。 */
function BlockEmpty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 py-1 text-sm text-muted-foreground">
      {icon}
      {text}
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

function InboxIcon({ className }: { className?: string }) {
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
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
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
  const settleQ = useSettleOrderListQuery(KISSEN_PROJECT_ID, {
    pageNum: 1,
    pageSize: 200,
    filter: {},
  });
  const instancesQ = useInstanceListQuery(KISSEN_PROJECT_ID, {
    pageNum: 1,
    pageSize: 200,
    filter: { status: 20 },
  });
  const lpsQ = useLpListQuery(KISSEN_PROJECT_ID, {
    pageNum: 1,
    pageSize: 200,
    filter: { status: 20 },
  });
  const tokensQ = useTokenListQuery(KISSEN_PROJECT_ID, { status: 20 });
  const tokenPairsQ = useTokenPairListQuery(KISSEN_PROJECT_ID, { status: 20 });

  const refreshing =
    todayQ.isFetching ||
    banksQ.isFetching ||
    exceptionsQ.isFetching ||
    poolsQ.isFetching ||
    reconcileQ.isFetching ||
    settleQ.isFetching ||
    instancesQ.isFetching ||
    lpsQ.isFetching ||
    tokensQ.isFetching ||
    tokenPairsQ.isFetching;

  const handleRefresh = React.useCallback(() => {
    void Promise.all([
      todayQ.refetch(),
      banksQ.refetch(),
      exceptionsQ.refetch(),
      poolsQ.refetch(),
      reconcileQ.refetch(),
      settleQ.refetch(),
      instancesQ.refetch(),
      lpsQ.refetch(),
      tokensQ.refetch(),
      tokenPairsQ.refetch(),
    ]);
  }, [
    todayQ,
    banksQ,
    exceptionsQ,
    poolsQ,
    reconcileQ,
    settleQ,
    instancesQ,
    lpsQ,
    tokensQ,
    tokenPairsQ,
  ]);

  // 今日概览（客户端聚合）
  const todayRows = todayQ.data?.data ?? [];
  const todayCount = todayRows.length;
  // 今日流水按源币种分组逐币种加总（userDeduction 属源币种金额，跨币种不可混计，
  // 2026-08-27 用户反馈口径同上游）；按金额降序；无交易按零流水显示 0（0 ≠ 无数据）。
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
  const inflightCount = todayRows.filter((r) =>
    Boolean(IN_FLIGHT[r.status]),
  ).length;
  // 入网银行（客户端过滤 status 20）
  const banks = (banksQ.data?.data ?? []).filter((b) => b.status === 20);

  // 异常队列
  const exceptionRows = exceptionsQ.data?.data ?? [];
  const exceptionTotal = exceptionsQ.data?.pagination.total ?? 0;

  // 资金池
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

  const networkCounts = {
    banks: banksQ.isError ? null : banks.length,
    instances: instancesQ.isError
      ? null
      : (instancesQ.data?.data.length ?? null),
    lps: lpsQ.isError ? null : (lpsQ.data?.data.length ?? null),
    tokenPairs: tokenPairsQ.isError ? null : (tokenPairsQ.data?.length ?? null),
  };
  const latestUpdatedAt = Math.max(
    todayQ.dataUpdatedAt,
    banksQ.dataUpdatedAt,
    exceptionsQ.dataUpdatedAt,
    poolsQ.dataUpdatedAt,
    reconcileQ.dataUpdatedAt,
    settleQ.dataUpdatedAt,
    instancesQ.dataUpdatedAt,
    lpsQ.dataUpdatedAt,
    tokensQ.dataUpdatedAt,
    tokenPairsQ.dataUpdatedAt,
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-4">
        {/* 页头 */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="t-supporting text-muted-foreground">
              NETWORK OPERATIONS
            </div>
            <h1 className="t-page-title">Dashboard</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Network operations at a glance
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Updated {latestUpdatedAt ? formatTime(latestUpdatedAt) : '-'}{' '}
              (UTC+8)
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshIcon className={cn(refreshing && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </header>

        {/* KPI 卡片：与 udpn-kissen 参考布局保持四列独立卡片结构。 */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 min-[1600px]:grid-cols-4">
          <MetricCard
            label="Pending Exceptions"
            tooltip="Transactions currently in Exception status and waiting for manual handling."
            value={
              exceptionsQ.isError ? (
                '—'
              ) : exceptionsQ.isLoading ? (
                <Skeleton className="h-9 w-16" />
              ) : (
                formatMoney(exceptionTotal)
              )
            }
            footer={
              exceptionTotal > 0
                ? 'Requires manual handling →'
                : 'No exceptions pending'
            }
            badge={{
              label: exceptionTotal > 0 ? 'Action needed' : 'Clear',
              variant: exceptionTotal > 0 ? 'destructive' : 'success',
            }}
            className="border-destructive/30 bg-gradient-to-b from-card to-destructive/5"
            valueClassName={exceptionTotal > 0 ? 'text-destructive' : undefined}
          />
          <MetricCard
            label="Transactions in Progress"
            tooltip="Created transactions that have not reached a final state."
            value={
              todayQ.isError ? (
                '—'
              ) : todayQ.isLoading ? (
                <Skeleton className="h-9 w-16" />
              ) : (
                formatMoney(inflightCount)
              )
            }
            footer={
              inflightCount > 0
                ? 'Live processing activity'
                : 'No transactions in progress'
            }
            badge={{ label: 'Live', variant: 'mute' }}
          />
          <MetricCard
            label="Today's Transactions"
            tooltip="Transactions created today, from local midnight through now."
            value={
              todayQ.isError ? (
                '—'
              ) : todayQ.isLoading ? (
                <Skeleton className="h-9 w-16" />
              ) : (
                formatMoney(todayCount)
              )
            }
          />
          <MetricCard
            label="Today's Volume by Token"
            tooltip="Today's transaction volume grouped by source token."
            value={
              todayQ.isError ? (
                '—'
              ) : todayQ.isLoading ? (
                <Skeleton className="h-9 w-28" />
              ) : todayVolumes.length === 0 ? (
                '0'
              ) : (
                <div className="flex flex-col gap-0.5 text-sm">
                  {todayVolumes.slice(0, 3).map((volume) => (
                    <div
                      key={volume.ccy}
                      className="flex justify-between gap-3"
                    >
                      <span className="font-bold text-foreground">
                        {volume.ccy}
                      </span>
                      <span>
                        {formatMoney(Number(volume.total.toFixed(2)))}
                      </span>
                    </div>
                  ))}
                </div>
              )
            }
            footer={`${todayVolumes.length} token${todayVolumes.length === 1 ? '' : 's'} traded today`}
            valueClassName="mt-2 min-h-[54px] text-base font-normal"
          />
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <Card className="min-w-0 rounded-[10px] p-5 lg:col-span-8">
            <PanelHeading
              title="Pending Exceptions"
              action={
                exceptionTotal > exceptionRows.length
                  ? `View all ${exceptionTotal} →`
                  : 'View all →'
              }
              onAction={() => router.push('/transfer/tx')}
            />
            {exceptionsQ.isError ? (
              <BlockFail onRetry={() => exceptionsQ.refetch()} />
            ) : exceptionsQ.isLoading ? (
              <BlockSkeleton rows={4} />
            ) : exceptionRows.length === 0 ? (
              <BlockEmpty
                icon={<CheckCircleIcon className="h-4 w-4 text-success" />}
                text="No exceptions to handle"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse">
                  <thead>
                    <tr>
                      {[
                        'Transaction No.',
                        'Token Pair',
                        'Amount',
                        'Status',
                        'Created on',
                        'Actions',
                      ].map((heading) => (
                        <th
                          key={heading}
                          className="whitespace-nowrap border-b border-border px-3 py-2 text-left text-xs font-semibold tracking-wide text-muted-foreground first:pl-0 last:pr-0"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {exceptionRows.map((row) => {
                      const transactionNumber = row.txNo || row.txUuid;
                      return (
                        <tr
                          key={row.transactionId}
                          className="hover:bg-muted/40"
                        >
                          <td className="max-w-[150px] truncate border-b border-border px-3 py-3 font-mono text-xs first:pl-0">
                            <span className="inline-flex max-w-full items-center gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="block truncate">
                                    {transactionNumber}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-sm break-all font-mono text-xs">
                                  {transactionNumber}
                                </TooltipContent>
                              </Tooltip>
                              {transactionNumber ? (
                                <CopyButton
                                  value={transactionNumber}
                                  label="transaction number"
                                />
                              ) : null}
                            </span>
                          </td>
                          <td className="border-b border-border px-3 py-3 text-sm">
                            {pairText(row)}
                          </td>
                          <td className="border-b border-border px-3 py-3 text-sm tabular-nums">
                            {formatMoney(row.principal)}
                          </td>
                          <td className="border-b border-border px-3 py-3">
                            <div className="flex flex-col items-start gap-1">
                              <Badge variant="destructive" size="sm">
                                Exception
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {TX_STATUS_MAP[row.status] ?? 'Exception'} ·{' '}
                                {formatAge(Date.now() - row.createTime)}
                              </span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap border-b border-border px-3 py-3 text-sm text-muted-foreground">
                            {formatTime(row.createTime)}
                          </td>
                          <td className="border-b border-border px-3 py-3 text-right last:pr-0">
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0"
                              onClick={() => router.push('/transfer/tx')}
                            >
                              View
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="min-w-0 lg:col-span-4">
            <SettlementOverview
              settleQuery={settleQ}
              reconcileQuery={reconcileQ}
              onViewAll={() => router.push('/settle/order')}
            />
          </div>
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
          <Card className="min-w-0 rounded-[10px] p-5 lg:col-span-4">
            <PanelHeading title="Network Overview" />
            <NetworkStat
              name="Banks"
              count={networkCounts.banks}
              hint="Onboarded and active"
            />
            <NetworkStat
              name="Gateway Instances"
              count={networkCounts.instances}
              hint="Connected gateways"
            />
            <NetworkStat
              name="Liquidity Providers"
              count={networkCounts.lps}
              hint="Active providers"
            />
            <NetworkStat
              name="Token Pairs"
              count={networkCounts.tokenPairs}
              hint="Supported pairs"
            />
          </Card>
        </section>
      </div>
    </TooltipProvider>
  );
}
