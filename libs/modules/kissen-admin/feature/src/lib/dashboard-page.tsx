'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BarChart3,
  Check,
  Clock,
  Info,
  RefreshCw,
} from 'lucide-react';

import {
  Badge,
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
  useSettleOrderListQuery,
  useTokenListQuery,
  useTokenPairListQuery,
} from '@myorg/modules/kissen-admin/data-access';

import { formatTokenAmount, formatUtc8 } from './proto-format';
import { PROTO_TX_STATUS, protoStatusLabel } from './proto-enums';
import { CopyableId, ProtoStatusBadge } from './proto-ui';
import { ProtoSortHeader, useProtoSort } from './proto-sort';

/**
 * DashboardPage —— KNMS 工作台（登录落点），对齐原型 DashboardPage.jsx（方案 12 P3）。
 *
 * 结构：页头（Updated + Refresh）→ 4 张 KPI 卡 → Pending Exceptions 表 +
 * Settlement Statements → Pool Overview + Network Overview。文案/列头/提示逐字
 * 对齐原型；数据全部来自现有列表接口，客户端只做展示所需的聚合/过滤：
 * - KPI：异常待处置 / 在途 / 今日笔数 / 今日代币对成交量（status Confirmed）
 * - 异常队列（status 70 前 5 笔，表头可排序）
 * - 结算状态（pending/confirmed/settled-7d）+ 对账横幅
 * - 资金池水位（token 维度，低于 remindThreshold 即告急）
 * - 网络概览（银行、网关实例、LP、Token Pairs，均带真实 Latest 提示）
 *
 * 各区块各自独立 react-query 查询，任一接口失败只降级对应区块，不整页报错。
 * 无独立 data-access 域：统计端点经 kissenPage 直接在本 feature 内薄调用。
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
  /** 到账金额（原型 Amount 列「源数量 → 目标数量」复合展示） */
  receiverAmount: string | number | null;
  sourceBankName: string;
  targetBankName: string;
  /** 用户扣款金额（今日流水客户端聚合口径） */
  userDeduction: string | number;
  createTime: number;
}

interface WorkbenchBankRow {
  bankId: number;
  bankName: string;
  /** 银行编码（BIC；v2.0 字段名 bankBic，随上游模型更名） */
  bankBic: string;
  /** 联系人（v2.0 银行行展示字段，替代 v1.x 的币种/限额组） */
  contactName: string;
  /** 20 入网生效（客户端过滤口径） */
  status: number;
  /** 网关连通性：0 未知 / 1 正常 / 2 断开（未登记实例为 0） */
  connectivityStatus: number;
  createTime: number;
}

interface WorkbenchPoolRow {
  poolId: number;
  tokenId: number;
  lpName: string;
  accountAddress?: string;
  /** 池维度 token code（v2.0 资金池为 token 维度，不再有 currency） */
  tokenCode: string;
  /** token 符号（余额展示追加，如 1.01 CF7） */
  tokenSymbol: string;
  /** Σ min liquidity（水位分母 = 引用该地址的生效参与对累计门槛；null = 未挂参与对） */
  requiredMinSum: string | number | null;
  /** 补资提醒阈值（水位低于此比例即告急） */
  remindThreshold: string | number;
  availableBalanceCache: string | number;
  preauthAvailable: string | number | null;
  status: number;
}

/** 结算单行（工作台只取状态与创建时间）。 */
interface WorkbenchSettleRow {
  status: number;
  createTime: number;
}

/** 工作台薄查询的分页响应形状（kissenPage 返回）。 */
interface WorkbenchPageResp<T> {
  data: T[];
  pagination: { total: number };
}

/** SettlementOverview 依赖的结算列表查询（结构子集，实参为完整 react-query 结果）。 */
interface SettleQueryLike {
  data: WorkbenchPageResp<WorkbenchSettleRow> | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => unknown;
}

/** SettlementOverview 依赖的对账查询（只读未处理差异 total 与错误态）。 */
interface ReconcileQueryLike {
  data: WorkbenchPageResp<unknown> | undefined;
  isError: boolean;
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

/** 原型 CoverageCell 水位条比例：coverage 219% 才满条，45.6% 位置为 100% 刻度线。 */
const COVERAGE_BAR_SCALE = 0.456;
const MIN_LIQUIDITY_MARK = COVERAGE_BAR_SCALE * 100;

/** 交易状态 → 徽章 tone（终态成功 / 逆转与失败 / 逆转中；未列出的主线节点一律 info）。 */
const TX_TONE: Record<number, 'success' | 'warning' | 'danger'> = {
  35: 'success',
  40: 'success',
  50: 'warning',
  60: 'danger',
  70: 'danger',
  90: 'danger',
};

// ---- 小工具 ----

/** 异常持续时长：now - createTime → "8m" / "5h 12m" / "2d 3h"（无创建时间占位 -）。 */
function formatAge(createTime: number): string {
  if (!createTime) return '-';
  const mins = Math.max(0, Math.floor((Date.now() - createTime) / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

/** 今日 0 点毫秒（与对账页 dayStart 口径一致，按运行环境本地日历计算）。 */
function dayStartMs(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}



/** 取 createTime 最新的行（Network Overview 的 Latest 提示）。 */
function latestByTime<T>(rows: T[], getTime: (row: T) => number): T | undefined {
  return rows.reduce<T | undefined>(
    (acc, row) => (getTime(row) > (acc ? getTime(acc) : 0) ? row : acc),
    undefined,
  );
}

// ---- 资金池水位（移植自 workbench index.vue） ----

/** 水位分子：可用余额与可用授权取小（未设置预授权时余额即分子，2026-09-08 口径）。 */
function poolNumerator(pool: WorkbenchPoolRow): number {
  const balance = Number(pool.availableBalanceCache);
  const avail =
    pool.preauthAvailable == null ? null : Number(pool.preauthAvailable);
  return avail != null &&
    !Number.isNaN(avail) &&
    avail >= 0 &&
    avail < balance
    ? avail
    : balance;
}

/** 水位 = min(可用授权, 可用余额) / Σ min liquidity（requiredMinSum）；低于补资提醒阈值即告急。 */
function isPoolCritical(pool: WorkbenchPoolRow): boolean {
  const min = pool.requiredMinSum == null ? Number.NaN : Number(pool.requiredMinSum);
  if (!(min > 0)) return false; // 分母无效（含未挂参与对）无法判断水位，按正常展示
  return poolNumerator(pool) / min < Number(pool.remindThreshold);
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

/** 今日交易（客户端聚合笔数/在途/代币对成交量；pageSize 200 为今日切片上限）。 */
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

/** ⓘ 提示触发器（原型 InfoTip：round ⓘ 按钮，键盘可达）。 */
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
          className="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground"
          tabIndex={0}
        >
          <Info className="h-3 w-3" aria-hidden="true" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-xs leading-relaxed">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

/** 区块标题 + 右侧链接动作（原型 SectionCard 头）。 */
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

/** KPI 卡（原型 KpiCard：label+ⓘ+pill / 大数字 / foot；alert 版红顶线渐变，可整卡点击跳转）。 */
function KpiCard({
  label,
  icon: LabelIcon,
  tip,
  pill,
  value,
  foot,
  alert = false,
  onClick,
  children,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  tip: string;
  pill?: { label: string; variant: 'destructive' | 'mute' };
  value?: React.ReactNode;
  foot?: React.ReactNode;
  alert?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Card
      role={onClick ? 'link' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter') onClick();
            }
          : undefined
      }
      className={cn(
        'rounded-[10px] p-4 transition-all',
        alert
          ? 'border-t-2 border-t-destructive bg-gradient-to-b from-card to-destructive/5'
          : 'border-t-2 border-t-primary',
        onClick && 'cursor-pointer hover:shadow-md',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          {LabelIcon ? (
            <LabelIcon className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          ) : null}
          <span className="min-w-0">{label}</span>
          <InfoTip label={`${label} definition`}>{tip}</InfoTip>
        </span>
        {pill ? (
          <Badge variant={pill.variant} size="sm" className="shrink-0">
            {pill.label}
          </Badge>
        ) : null}
      </div>
      {value !== undefined ? (
        <div
          className={cn(
            'mt-1.5 text-3xl font-bold leading-none tracking-tight tabular-nums',
            alert && 'text-destructive',
          )}
        >
          {value}
        </div>
      ) : null}
      {children}
      {foot ? (
        <div
          className={cn(
            'mt-1 text-xs font-medium text-muted-foreground',
            alert && 'font-semibold text-destructive',
          )}
        >
          {foot}
        </div>
      ) : null}
    </Card>
  );
}

/** 结算状态行（原型 statements 行：徽章 + note + 计数 statement/statements）。 */
function StatLine({
  label,
  tone,
  count,
  hint,
}: {
  label: string;
  tone: 'warning' | 'muted' | 'success';
  count: number | null;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0">
      <span className="flex min-w-0 items-center gap-2 font-medium">
        <ProtoStatusBadge tone={tone}>{label}</ProtoStatusBadge>
        {hint ? (
          <span className="truncate text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </span>
      <span className="shrink-0 font-bold tabular-nums">
        {count == null ? '-' : count}{' '}
        <span className="text-xs font-medium text-muted-foreground">
          {count === 1 ? 'statement' : 'statements'}
        </span>
      </span>
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

/** 区块空态：图标 + muted 文案。 */
function BlockEmpty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 py-1 text-sm text-muted-foreground">
      {icon}
      {text}
    </div>
  );
}

// ---- Pending Exceptions 表（原型：Transaction No./Tokens/Amount/Status/Created on (UTC+8)/Actions） ----

function ExceptionTable({
  rows,
  isLoading,
  isError,
  onRetry,
  onDetails,
}: {
  rows: WorkbenchTxRow[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onDetails: (row: WorkbenchTxRow) => void;
}) {
  // 排序取值器（页面字面量，语义稳定）。
  const getters = {
    id: { value: (row: WorkbenchTxRow) => row.txNo || row.txUuid },
    status: {
      value: (row: WorkbenchTxRow) => protoStatusLabel(PROTO_TX_STATUS, row.status),
    },
    createdAt: {
      value: (row: WorkbenchTxRow) => row.createTime,
      defaultDir: 'desc' as const,
    },
  };
  const { sorted, toggle, sortState } = useProtoSort(
    rows,
    getters,
    'createdAt',
    'desc',
  );

  const TH =
    'whitespace-nowrap border-b border-border px-3 py-2 text-left text-xs font-semibold tracking-wide text-muted-foreground';

  if (isError) return <BlockFail onRetry={onRetry} />;
  if (isLoading) return <BlockSkeleton rows={4} />;
  if (sorted.length === 0)
    return (
      <BlockEmpty
        icon={<Check className="h-4 w-4 text-success" aria-hidden="true" />}
        text="No exceptions to handle"
      />
    );

  return (
    <div className="max-md:overflow-x-auto md:overflow-hidden">
      <table className="w-full min-w-0 max-md:min-w-[820px] table-fixed border-collapse">
        <thead>
          <tr>
            <th className={cn(TH, 'w-[18%]')}>
              <ProtoSortHeader
                label="Transaction No."
                columnKey="id"
                toggle={toggle}
                sortState={sortState('id')}
              />
            </th>
            <th className={cn(TH, 'w-[16%]')}>Tokens</th>
            <th className={cn(TH, 'w-[15%]')}>Amount</th>
            <th className={cn(TH, 'w-[15%]')}>
              <ProtoSortHeader
                label="Status"
                columnKey="status"
                toggle={toggle}
                sortState={sortState('status')}
              />
            </th>
            <th className={cn(TH, 'w-[20%]')}>
              <ProtoSortHeader
                label="Created on"
                columnKey="createdAt"
                toggle={toggle}
                sortState={sortState('createdAt')}
              />
            </th>
            <th className={cn(TH, 'w-[9%] text-right')}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const pair =
              row.sourceCurrency && row.targetCurrency
                ? `${row.sourceCurrency} → ${row.targetCurrency}`
                : '-';
            const banks =
              row.sourceBankName || row.targetBankName
                ? `${row.sourceBankName || '-'} - ${row.targetBankName || '-'}`
                : null;
            const statusLabel = protoStatusLabel(PROTO_TX_STATUS, row.status);
            return (
              <tr key={row.transactionId} className="hover:bg-muted/40">
                <td className="border-b border-border px-3 py-2.5 font-mono text-xs">
                  <CopyableId value={row.txNo || row.txUuid} />
                </td>
                <td className="border-b border-border px-3 py-2.5 text-sm">
                  <span className="block truncate font-semibold" title={pair}>
                    {pair}
                  </span>
                  {banks ? (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground" title={banks}>
                      {banks}
                    </span>
                  ) : null}
                </td>
                {/* 复合单元格（双向金额）左对齐（原型 2026-09-22 口径）。 */}
                <td className="border-b border-border px-3 py-2.5 text-sm tabular-nums">
                  {formatTokenAmount(row.principal)}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {row.sourceCurrency || '-'}
                  </span>
                  <span aria-hidden="true" className="mx-1 text-muted-foreground">
                    →
                  </span>
                  {formatTokenAmount(row.receiverAmount)}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {row.targetCurrency || '-'}
                  </span>
                </td>
                <td className="border-b border-border px-3 py-2.5">
                  <div className="flex flex-col items-start gap-1">
                    <ProtoStatusBadge tone={TX_TONE[row.status] ?? 'info'}>
                      {statusLabel}
                    </ProtoStatusBadge>
                    {/* 后端无独立 stage 字段：以状态文案近似原型的 at {stage} · {elapsed}。 */}
                    <span className="text-xs text-muted-foreground">
                      at {statusLabel} · {formatAge(row.createTime)}
                    </span>
                  </div>
                </td>
                <td className="border-b border-border px-3 py-2.5 text-sm text-muted-foreground">
                  <span className="block truncate" title={formatUtc8(row.createTime)}>
                    {formatUtc8(row.createTime)}
                  </span>
                </td>
                <td className="border-b border-border px-3 py-2.5 text-right last:pr-0">
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0"
                    onClick={() => onDetails(row)}
                  >
                    Details
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---- Settlement Statements（原型 statements 三行 + 对账横幅） ----

function SettlementOverview({
  settleQuery,
  reconcileQuery,
  onViewAll,
}: {
  settleQuery: SettleQueryLike;
  reconcileQuery: ReconcileQueryLike;
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
            tone="warning"
            count={countByStatus(10)}
          />
          <StatLine label="Confirmed" tone="muted" count={countByStatus(20)} />
          <StatLine
            label="Settled"
            tone="success"
            count={countByStatus(35, settledSince)}
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
        {reconcileQuery.isError || diffPending > 0 ? (
          <span aria-hidden="true">!</span>
        ) : (
          <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
        )}
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

// ---- Pool Overview（原型列：LP Name/Pool Address/Token Name/Wallet Balance/Authorized Amount/Liq. Coverage） ----

/** 水位单元格：比例条（45.6% 刻度线）+ 百分比（悬停回显计算式）+ Sufficient/Low 徽章。 */
function CoverageCell({ pool }: { pool: WorkbenchPoolRow }) {
  const critical = isPoolCritical(pool);
  const requiredMinSum =
    pool.requiredMinSum == null ? Number.NaN : Number(pool.requiredMinSum);
  const numerator = poolNumerator(pool);
  const hasCalculation =
    Number.isFinite(numerator) &&
    Number.isFinite(requiredMinSum) &&
    requiredMinSum > 0;
  const percentage = hasCalculation
    ? Math.round((numerator / requiredMinSum) * 100)
    : null;
  // 三档水位色（原型 2026-09-20 口径）：0 → 红，低于阈值 → 琥珀，充足 → 绿。
  const barTone =
    percentage != null && percentage <= 0
      ? 'bg-destructive'
      : critical
        ? 'bg-warning'
        : 'bg-success';
  const fillWidth =
    percentage == null ? 0 : Math.min(100, Math.round(percentage * COVERAGE_BAR_SCALE));
  const alertThreshold = Number(pool.remindThreshold);
  const alertThresholdText = Number.isFinite(alertThreshold)
    ? `${Math.round(alertThreshold * 100)}%`
    : '-';

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span
        aria-hidden="true"
        className="relative h-1.5 w-[90px] shrink-0 rounded bg-muted"
      >
        {percentage != null ? (
          <span
            className={cn('absolute inset-y-0 left-0 rounded', barTone)}
            style={{ width: `${fillWidth}%` }}
          />
        ) : null}
        <span
          className="absolute -inset-y-[3px] w-0.5 bg-muted-foreground/50"
          style={{ left: `${MIN_LIQUIDITY_MARK}%` }}
        />
      </span>
      <span className="inline-flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              tabIndex={0}
              className="cursor-help text-xs tabular-nums text-muted-foreground"
            >
              {percentage == null ? '-' : `${percentage}%`}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-64 text-xs">
            {hasCalculation ? (
              <div className="tabular-nums">
                <div>
                  min ({formatTokenAmount(pool.availableBalanceCache)},{' '}
                  {formatTokenAmount(pool.preauthAvailable)}) ÷{' '}
                  {formatTokenAmount(requiredMinSum)} ={' '}
                  <strong>{percentage}%</strong>
                </div>
                {/* 行级阈值用后端逐池 remindThreshold（原型为全局常量 20%，表头 ⓘ 保留原型文案）。 */}
                <div>Low Liquidity Threshold: {alertThresholdText}</div>
              </div>
            ) : (
              <div>Pool level unavailable</div>
            )}
          </TooltipContent>
        </Tooltip>
        <ProtoStatusBadge tone={critical ? 'danger' : 'success'}>
          {critical ? 'Low' : 'Sufficient'}
        </ProtoStatusBadge>
      </span>
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
    lpName: { value: (pool: WorkbenchPoolRow) => pool.lpName || '-' },
    token: {
      value: (pool: WorkbenchPoolRow) =>
        tokenNames.get(pool.tokenId) || pool.tokenCode || '-',
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

  const TH =
    'whitespace-nowrap border-b border-border px-3 py-2 text-left text-xs font-semibold tracking-wide text-muted-foreground';

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
      ) : sorted.length === 0 ? (
        <BlockEmpty icon={<Info className="h-4 w-4 text-muted-foreground" aria-hidden="true" />} text="No pools yet" />
      ) : (
        <div className="max-md:overflow-x-auto md:overflow-hidden">
          <table className="w-full min-w-0 max-md:min-w-[860px] table-fixed border-collapse">
            <thead>
              <tr>
                <th className={cn(TH, 'w-[15%]')}>
                  <ProtoSortHeader
                    label="LP Name"
                    columnKey="lpName"
                    toggle={toggle}
                    sortState={sortState('lpName')}
                  />
                </th>
                <th className={cn(TH, 'w-[20%]')}>Pool Address</th>
                <th className={cn(TH, 'w-[12%]')}>
                  <ProtoSortHeader
                    label="Token Name"
                    columnKey="token"
                    toggle={toggle}
                    sortState={sortState('token')}
                  />
                </th>
                <th className={cn(TH, 'w-[16%] text-right')}>
                  <div className="flex justify-end">
                    <ProtoSortHeader
                      label="Wallet Balance"
                      columnKey="walletBalance"
                      toggle={toggle}
                      sortState={sortState('walletBalance')}
                    />
                  </div>
                </th>
                <th className={cn(TH, 'w-[19%] text-right')}>
                  <div className="flex justify-end">
                    <ProtoSortHeader
                      label="Authorized Amount"
                      columnKey="authorizedAmount"
                      toggle={toggle}
                      sortState={sortState('authorizedAmount')}
                    />
                  </div>
                </th>
                <th className={cn(TH, 'w-[18%]')}>
                  <span className="inline-flex items-center gap-1">
                    Liq. Coverage
                    <InfoTip label="Coverage formula">
                      <div>
                        Liquidity Coverage = min (Available Balance, Available
                        Pre-Authorized) ÷ Min. Liquidity
                      </div>
                      <div>Low Liquidity Threshold: 20%</div>
                    </InfoTip>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((pool) => {
                const tokenName =
                  tokenNames.get(pool.tokenId) || pool.tokenCode || '-';
                return (
                  <tr key={pool.poolId} className="hover:bg-muted/40">
                    <td className="border-b border-border px-3 py-2.5 text-sm font-medium">
                      <span className="block truncate" title={pool.lpName || '-'}>
                        {pool.lpName || '-'}
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
                    {/* 后端仅缓存可用口径单值，无总额/可用额拆分 → 不渲染原型 Avail 副行。 */}
                    <td className="border-b border-border px-3 py-2.5 text-right text-sm tabular-nums">
                      <span
                        className="block truncate font-semibold"
                        title={formatTokenAmount(pool.availableBalanceCache)}
                      >
                        {formatTokenAmount(pool.availableBalanceCache)}
                        <span className="ml-1 text-xs font-medium text-muted-foreground">
                          {pool.tokenSymbol}
                        </span>
                      </span>
                    </td>
                    <td className="border-b border-border px-3 py-2.5 text-right text-sm tabular-nums">
                      <span
                        className="block truncate font-semibold"
                        title={formatTokenAmount(pool.preauthAvailable)}
                      >
                        {formatTokenAmount(pool.preauthAvailable)}
                        <span className="ml-1 text-xs font-medium text-muted-foreground">
                          {pool.tokenSymbol}
                        </span>
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

// ---- Network Overview（Banks / Gateway Instances / LPs / Token Pairs，带真实 Latest 提示） ----

function NetworkStat({
  name,
  hint,
  tip,
  value,
}: {
  name: string;
  hint: string;
  tip?: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-sm font-semibold">
          {name}
          {tip ? <InfoTip label={`${name} connectivity`}>{tip}</InfoTip> : null}
        </div>
        <div className="mt-px truncate text-xs font-medium text-muted-foreground">
          {hint}
        </div>
      </div>
      <div className="shrink-0 text-right text-xl font-bold tabular-nums">
        {value}{' '}
        <span className="text-xs font-medium text-muted-foreground">active</span>
      </div>
    </div>
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

  // ---- 客户端聚合 ----

  const todayRows = todayQ.data?.data ?? [];
  const todayCount = todayRows.length;
  const inflightCount = todayRows.filter((r) =>
    Boolean(IN_FLIGHT[r.status]),
  ).length;

  // 今日代币对成交量（原型 KPI4 口径：仅 status Confirmed(10)；金额 = 该对源 token
  // 本日 principal 累计；银行副行取该对最新一笔）。
  const todayPairs = React.useMemo(() => {
    const byPair = new Map<
      string,
      { pair: string; banks: string; amount: number }
    >();
    for (const row of todayRows) {
      if (row.status !== 10) continue;
      const src = row.sourceCurrency || '-';
      const tgt = row.targetCurrency || '-';
      const key = `${src}→${tgt}`;
      const prev = byPair.get(key);
      byPair.set(key, {
        pair: `${src} → ${tgt}`,
        banks: `${row.sourceBankName || '-'} - ${row.targetBankName || '-'}`,
        amount: (prev?.amount ?? 0) + (Number(row.principal) || 0),
      });
    }
    return [...byPair.entries()].map(([key, item]) => ({ key, ...item }));
  }, [todayRows]);

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

  // Network Overview：真实 Latest 提示 + 网关连通性口径
  const latestBank = latestByTime(banks, (b) => b.createTime);
  const lpRows = lpsQ.data?.data ?? [];
  const latestLp = latestByTime(lpRows, (r) => r.createTime);
  const pairRows = tokenPairsQ.data ?? [];
  const latestPair = latestByTime(pairRows, (r) => r.createTime);
  const instanceRows = instancesQ.data?.data ?? [];
  const gatewayConnected = instanceRows.filter(
    (row) => row.connectivityStatus === 1,
  ).length;
  const gatewayDown = instanceRows.some((row) => row.connectivityStatus === 2);
  const lastHeartbeat = instanceRows.reduce<number>(
    (max, row) => Math.max(max, row.lastHeartbeatTime || 0),
    0,
  );

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
        {/* 页头（原型 PageHeader：title + Updated + Refresh） */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="t-page-title">Dashboard</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Updated {latestUpdatedAt ? formatUtc8(latestUpdatedAt) : '-'}
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

        {/* Row 1 — KPI */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 min-[1600px]:grid-cols-4">
          <KpiCard
            alert
            icon={AlertTriangle}
            label="Pending Exceptions"
            tip="Count of transactions currently in Exception status, regardless of when they were created. Cleared once resolved."
            pill={{ label: 'Action needed', variant: 'destructive' }}
            value={
              exceptionsQ.isError ? (
                '-'
              ) : exceptionsQ.isLoading ? (
                <Skeleton className="h-9 w-16" />
              ) : (
                exceptionTotal
              )
            }
            foot={
              exceptionTotal > 0 ? 'Requires manual handling →' : undefined
            }
            onClick={() => router.push('/transfer/tx?status=Exception')}
          />
          <KpiCard
            icon={Clock}
            label="Transactions in Progress"
            tip="Created but not yet in a final state (Settled, Completed, Failed, Reversed, or Cancelled)."
            pill={{ label: 'Live', variant: 'mute' }}
            value={
              todayQ.isError ? (
                '-'
              ) : todayQ.isLoading ? (
                <Skeleton className="h-9 w-16" />
              ) : (
                inflightCount
              )
            }
            foot={inflightCount === 0 ? 'No transactions in progress' : undefined}
          />
          <KpiCard
            icon={Check}
            label="Today's Transactions"
            tip="Transactions created today, 00:00–24:00 (UTC+8), in any status."
            value={
              todayQ.isError ? (
                '-'
              ) : todayQ.isLoading ? (
                <Skeleton className="h-9 w-16" />
              ) : (
                todayCount
              )
            }
          />
          <KpiCard
            icon={BarChart3}
            label="Today's Volume by Token Pair"
            tip="Today's traded token pairs (status: Confirmed). Amount is the accumulated principal of the pair's source token; the second line shows the source and target banks."
            foot={`${todayPairs.length} token pairs traded today`}
          >
            <div className="mt-2 flex flex-col gap-2">
              {todayPairs.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div
                      className="truncate text-sm font-bold"
                      title={item.pair}
                    >
                      {item.pair}
                    </div>
                    <div
                      className="mt-0.5 truncate text-xs text-muted-foreground"
                      title={item.banks}
                    >
                      {item.banks}
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums">
                    {formatTokenAmount(item.amount.toFixed(2))}
                  </span>
                </div>
              ))}
            </div>
          </KpiCard>
        </section>

        {/* Row 2 — Pending Exceptions + Settlement Statements */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <Card className="min-w-0 rounded-[10px] p-5 lg:col-span-12 min-[1600px]:col-span-8">
            <PanelHeading
              title="Pending Exceptions"
              action={`View all ${exceptionTotal} →`}
              onAction={() => router.push('/transfer/tx')}
            />
            <ExceptionTable
              rows={exceptionRows}
              isLoading={exceptionsQ.isLoading}
              isError={exceptionsQ.isError}
              onRetry={() => exceptionsQ.refetch()}
              onDetails={(row) =>
                router.push(
                  `/transfer/tx?transactionNo=${encodeURIComponent(
                    row.txNo || row.txUuid,
                  )}`,
                )
              }
            />
          </Card>
          <div className="min-w-0 lg:col-span-12 min-[1600px]:col-span-4">
            <SettlementOverview
              settleQuery={settleQ}
              reconcileQuery={reconcileQ}
              onViewAll={() => router.push('/settle/order')}
            />
          </div>
        </section>

        {/* Row 3 — Pool Overview + Network Overview */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-12 min-[1600px]:col-span-8">
            <PoolOverview
              pools={pools}
              tokenNames={tokenNames}
              isLoading={poolsQ.isLoading}
              isError={poolsQ.isError}
              onRetry={() => poolsQ.refetch()}
              onViewAll={() => router.push('/liquidity/pool')}
            />
          </div>
          <Card className="min-w-0 rounded-[10px] p-5 lg:col-span-12 min-[1600px]:col-span-4">
            <PanelHeading title="Network Overview" />
            <NetworkStat
              name="Banks"
              hint={
                latestBank
                  ? `Latest: ${latestBank.bankName} · onboarded ${formatUtc8(latestBank.createTime)}`
                  : '-'
              }
              value={banksQ.isError ? '-' : banks.length}
            />
            <NetworkStat
              name="Gateway Instances"
              tip="Gateways reporting a heartbeat within the expected interval. An Active gateway that is Disconnected blocks all transactions for its bank."
              hint={
                lastHeartbeat
                  ? `Last heartbeat ${formatAge(lastHeartbeat)} ago`
                  : '-'
              }
              value={
                instancesQ.isError ? (
                  '-'
                ) : (
                  <span className={gatewayDown ? 'text-destructive' : undefined}>
                    {gatewayConnected}
                    <span className="text-xs font-medium text-muted-foreground">
                      {' '}
                      / {instanceRows.length} connected
                    </span>
                  </span>
                )
              }
            />
            <NetworkStat
              name="Liquidity Providers"
              hint={
                latestLp
                  ? `Latest: ${latestLp.lpName} · onboarded ${formatUtc8(latestLp.createTime)}`
                  : '-'
              }
              value={lpsQ.isError ? '-' : lpRows.length}
            />
            <NetworkStat
              name="Token Pairs"
              hint={
                latestPair
                  ? `Latest: ${latestPair.sourceSymbol || latestPair.sourceTokenCode || '-'} → ${latestPair.targetSymbol || latestPair.targetTokenCode || '-'} · activated ${formatUtc8(latestPair.createTime)}`
                  : '-'
              }
              value={tokenPairsQ.isError ? '-' : pairRows.length}
            />
          </Card>
        </section>
      </div>
    </TooltipProvider>
  );
}
