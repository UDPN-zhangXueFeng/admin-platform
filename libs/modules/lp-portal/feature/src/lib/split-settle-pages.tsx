'use client';

/**
 * Revenue Share & Settlement 三页签合并页 + 结算单详情（方案 12 §6 行
 * 127-128，原型 `RevenueSettlementPage.jsx` / `SettlementStatementDetailPage.jsx`
 * 行为规格重实现）。
 *
 * 行为契约：
 * - 页头 Refresh = 单一 SyncRefreshButton(domain=['pair','rate','settle_order'])
 *   一次刷三域（比例/汇率 + 结算单；01 §E6 域映射），refetch 全部查询。
 * - 汇总条（GAP-LP-01 STATIC-FILLER）：My Share (MTD) / Next cycle /
 *   Pending Confirmation——后端无 /lp/dashboard/summary 聚合字段，静态补齐。
 * - 页签 ?tab=（effective/details/statements，非法值回 details，replace 不入
 *   历史）：Effective Revenue Shares（pair 域全量，本地排序即全量排序）/
 *   Revenue Share Details（分页 + Token Pair/时间窗服务端筛选）/
 *   Settlement Statements（分页 + 周期/状态服务端筛选）。三查询常驻挂载，
 *   页签只切视图。明细汇总行 GAP-LP-07：服务端 summary 跨币种加总失真，
 *   改按当前页行 currency 分组合计（仅当前页，过渡口径）。
 * - 文案对齐 GAP-LP-12：orderId → Statement No.、periodType → Settlement
 *   Cycle、periodStart/End → Period Range、currencies → Tokens、txCount →
 *   Transactions；Generated on 后端无 generatedAt（syncTime 为数据同步时间，
 *   非出单时间）→ 显 '-'。
 * - 结算单详情 `?statementNo=` 查询参分支（registry 仅映射 list；同参可独立
 *   挂 SettlementStatementDetailPage）。无 GET /lp/settle/orders/{id} 详情
 *   端点：列表行 sessionStorage 暂存（row-stash 同款）为基准，分项直读
 *   row.items，本单周期流水按 orderId 拉 /settle/order-records；直接深链无
 *   暂存 → not-found 态。
 * - 分页表本地排序（GAP-LP-05 过渡口径：服务端无排序参数，仅当前页有效）。
 * - 金额口径：formatTokenAmount 按 pairCode 源 token 精度（千分位 + HALF_UP
 *   + 去尾零）；比率 0〜1 → formatPercent(×100) 去尾零百分比。
 */
import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { type ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, CircleHelp } from 'lucide-react';

import {
  Badge,
  Button,
  DataTable,
  Tabs,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@myorg/shared/ui';
import {
  FormField,
  FormSelect,
  type SelectOption,
} from '@myorg/shared/ui-forms';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  LP_PROJECT_ID,
  SETTLE_PERIOD_TYPE_LABEL,
  useSettleOrderRecordsQuery,
  useSettleOrdersQuery,
  useSplitDetailQuery,
  useSplitRatiosQuery,
  useTokenMeta,
  txNoText,
  type SettleOrderItem,
  type SettleOrderRow,
  type SettleRecordRow,
  type SplitDetailRow,
  type SplitRow,
} from '@myorg/modules/lp-portal/data-access';

import {
  formatPercent,
  formatRate,
  formatTokenAmount,
  formatUtc8,
} from './proto-format';
import {
  CopyableId,
  Dash,
  ProtoStatusBadge,
  type ProtoTone,
} from './proto-ui';
import { LP_PAIR_STATUS_MAP, LP_STATEMENT_STATUS_MAP } from './proto-enums';
import {
  ProtoSortHeader,
  useProtoSort,
  type ProtoSortGetter,
} from './proto-sort';
import { SyncRefreshButton } from './sync-refresh-button';

/* ================================================================== */
/* 常量与静态补齐                                                       */
/* ================================================================== */

const PROJECT_ID = LP_PROJECT_ID;
/** 源 el-pagination 固定 page-size 10。 */
const PAGE_SIZE = 10;
/** 列表路由（结算单详情以 ?statementNo= 查询参挂同一路由）。 */
const LIST_ROUTE = '/split-settle';

const TAB_VALUES = ['effective', 'details', 'statements'] as const;
type SplitTab = (typeof TAB_VALUES)[number];

const LBL = {
  eyebrow: 'BUSINESS',
  title: 'Revenue Share & Settlement',
  query: 'Search',
  reset: 'Reset',
  tabEffective: 'Effective Revenue Shares',
  tabDetails: 'Revenue Share Details',
  tabStatements: 'Settlement Statements',
  emptyEffective: 'No revenue shares yet',
  emptyDetailsFiltered: 'No revenue share records for the current filters',
  emptyDetails: 'No revenue share records yet',
  emptyStatementsFiltered: 'No settlement statements for the current filters',
  emptyStatements: 'No settlement statements yet',
  emptyItems: 'No item data',
  emptyRecords: 'No records within this order period',
  baseRateHint:
    'Base Rate is the rate configured in this system; Mid-market Rate is the market reference price.',
  itemsHint:
    'Amount totals are shown per token pair (amounts in different tokens cannot be summed)',
  detail: 'Details',
} as const;

// STATIC-FILLER(GAP-LP-01): 后端无 /lp/dashboard/summary 聚合字段
// （revenueShareMTD / nextCycleEnd / pendingConfirmationCount），汇总条
// 静态补齐；后端补齐后删除本组常量并改走 queries。
const SUMMARY_SHARE_MTD_FALLBACK = { amount: '0', token: 'CXC' } as const;
const SUMMARY_NEXT_CYCLE_END_FALLBACK = '2026-10-01';
const SUMMARY_PENDING_CONFIRMATION_FALLBACK = 0;

/** 下拉「全部」哨兵（FormSelect 禁空 value；非 ALL 即转实参查询）。 */
const ALL = 'all';

/** 结算周期 rank（Daily 1 / Weekly 2 / Monthly 3；未知码排最后）。 */
const PERIOD_RANK: Record<number, number> = { 1: 1, 2: 2, 3: 3 };

/* ── 筛选表单与选项 ────────────────────────────────────────────────── */

interface OrdersFilterForm {
  periodType: string;
  status: string;
}

const EMPTY_ORDERS_FILTER: OrdersFilterForm = { periodType: ALL, status: ALL };

interface DetailFilterForm {
  pairCode: string;
  startTime: string;
  endTime: string;
}

const EMPTY_DETAIL_FILTER: DetailFilterForm = {
  pairCode: ALL,
  startTime: '',
  endTime: '',
};

interface OrdersParams {
  pageNum: number;
  periodType?: number;
  status?: number;
}

interface DetailParams {
  pageNum: number;
  pairCode?: string;
  startTime?: number;
  endTime?: number;
}

/** 周期选项（码序 1/2/3 = Daily/Weekly/Monthly）。 */
const PERIOD_OPTIONS: SelectOption[] = Object.keys(
  SETTLE_PERIOD_TYPE_LABEL,
).map((k) => ({
  value: k,
  label: SETTLE_PERIOD_TYPE_LABEL[Number(k)],
}));

/** 结算单状态选项（LP_STATEMENT_STATUS_MAP 码序 = rank 序）。 */
const STATEMENT_STATUS_OPTIONS: SelectOption[] = Object.keys(
  LP_STATEMENT_STATUS_MAP,
).map((k) => ({
  value: k,
  label: LP_STATEMENT_STATUS_MAP[Number(k)].label,
}));

/* ── 结算单行暂存（列表 → 详情；无详情端点） ──────────────────────── */

const ORDER_STASH_PREFIX = 'lp_settle_order_stash:';

function stashOrderRow(orderKey: string, row: SettleOrderRow): void {
  try {
    window.sessionStorage.setItem(
      `${ORDER_STASH_PREFIX}${orderKey}`,
      JSON.stringify(row),
    );
  } catch {
    // 私密模式 / 配额满等场景静默（详情页落 not-found 态）
  }
}

function peekOrderRow(orderKey: string): SettleOrderRow | null {
  try {
    const raw = window.sessionStorage.getItem(
      `${ORDER_STASH_PREFIX}${orderKey}`,
    );
    return raw ? (JSON.parse(raw) as SettleOrderRow) : null;
  } catch {
    return null;
  }
}

/* ================================================================== */
/* 渲染辅助                                                             */
/* ================================================================== */

/** 比率（0〜1）→ 原型百分比（×100 后 formatPercent 去尾零）；空 → '-'。 */
function percentOf(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '-';
  const n = Number(v);
  return Number.isNaN(n) ? '-' : formatPercent(n * 100);
}

/** 数值取值器（排序口径）：空/非数字 → null（排序时空值恒排最后）。 */
function numOf(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/** 结算单状态语义色：10 待确认警示 / 20 已确认 / 35 已结算成功 / 45 作废危险。 */
function statementStatusTone(status: number): ProtoTone {
  if (status === 35) return 'success';
  if (status === 45) return 'danger';
  if (status === 10) return 'warning';
  if (status === 20) return 'primary';
  return 'muted';
}

function StatementStatusBadge({ status }: { status: number }) {
  const entry = LP_STATEMENT_STATUS_MAP[status];
  return (
    <ProtoStatusBadge
      label={entry?.label ?? String(status)}
      tone={statementStatusTone(status)}
    />
  );
}

/** Token Pair 参与状态语义色：20 生效 / 5 待定 / 15 驳回 / 50 停用。 */
function pairStatusTone(status: number): ProtoTone {
  if (status === 20) return 'success';
  if (status === 5) return 'warning';
  if (status === 15) return 'danger';
  return 'muted';
}

function PairStatusBadge({ status }: { status: number }) {
  const entry = LP_PAIR_STATUS_MAP[status];
  return (
    <ProtoStatusBadge
      label={entry?.label ?? String(status)}
      tone={pairStatusTone(status)}
    />
  );
}

/** Token 对紧凑两行式：SYM → SYM 加粗行（币对箭头口径）+ 银行次要行。 */
function PairX({
  source,
  target,
  bankOf,
  symOf,
}: {
  source: string;
  target: string;
  bankOf: (code: string) => string;
  symOf: (code: string) => string;
}) {
  return (
    <div className="flex min-w-0 flex-col leading-normal">
      <div className="font-mono text-xs font-semibold tabular-nums">
        {symOf(source)} → {symOf(target)}
      </div>
      <div className="truncate text-xs text-muted-foreground">
        {bankOf(source)} → {bankOf(target)}
      </div>
    </div>
  );
}

/** 金额单元格：formatTokenAmount 按 token 精度 + 右对齐等宽。 */
function MoneyRight({
  v,
  dec,
}: {
  v: number | string | null | undefined;
  dec: number;
}) {
  return (
    <span className="block text-right font-mono text-xs tabular-nums">
      {formatTokenAmount(v, dec)}
    </span>
  );
}

/** Key-figure 强调（My Share 列）；dec 同 MoneyRight 口径。 */
function KeyFigureRight({
  v,
  dec,
}: {
  v: number | string | null | undefined;
  dec: number;
}) {
  return (
    <span className="block text-right font-mono text-sm font-semibold tabular-nums">
      {formatTokenAmount(v, dec)}
    </span>
  );
}

/** 详情字段 widget：dt 小号灰标签，dd 常规；空值灰 '-'。 */
function Item({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 min-w-0 break-all text-sm">{children}</dd>
    </div>
  );
}

/** 汇总条单元（GAP-LP-01 静态补齐值）。 */
function SummaryCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <div className="text-xs font-medium capitalize text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-xl font-bold tabular-nums">{children}</div>
    </div>
  );
}

/** 'YYYY-MM-DD' → 'Oct 1'（原型 Intl en-US 月+日短格式）。 */
function shortCycleLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? isoDate
    : new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }).format(d);
}

/** 详情骨架（暂存行 effect 落定前的首帧）。 */
function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-16 motion-safe:animate-pulse rounded-lg bg-muted" />
      <div className="h-40 motion-safe:animate-pulse rounded-lg bg-muted" />
      <div className="h-32 motion-safe:animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

/* ── pair 域上下文（主视图/详情视图共用；react-query 缓存共享） ────── */

interface PairContext {
  ratioRows: SplitRow[];
  ratioPending: boolean;
  refetchRatios: () => void;
  symOf: (code: string) => string;
  bankOf: (code: string) => string;
  /** pairCode → 卡1 参与行；未命中 undefined（调用方回退纯 pairCode 文本）。 */
  pairInfo: (pairCode: string | null | undefined) => SplitRow | undefined;
  /** 金额小数位：pairCode 对应源 token 的 decimalDigits（兜底 2）。 */
  decOf: (pairCode: string | null | undefined) => number;
  /** Token 对紧凑式；pairInfo 未命中回退纯文本。 */
  renderPairX: (pairCode: string | null | undefined) => React.ReactNode;
}

function usePairContext(): PairContext {
  const { bankOf, symOf, decimalsOf } = useTokenMeta(PROJECT_ID);
  const ratioQuery = useSplitRatiosQuery(PROJECT_ID);
  const ratioRows = ratioQuery.data ?? [];

  const pairInfo = React.useCallback(
    (pairCode: string | null | undefined): SplitRow | undefined =>
      pairCode ? ratioRows.find((r) => r.pairCode === pairCode) : undefined,
    [ratioRows],
  );

  const decOf = React.useCallback(
    (pairCode: string | null | undefined): number =>
      decimalsOf(pairInfo(pairCode)?.sourceTokenCode),
    [decimalsOf, pairInfo],
  );

  const renderPairX = React.useCallback(
    (pairCode: string | null | undefined) => {
      const info = pairInfo(pairCode);
      if (info) {
        return (
          <PairX
            source={info.sourceTokenCode}
            target={info.targetTokenCode}
            bankOf={bankOf}
            symOf={symOf}
          />
        );
      }
      return <span>{pairCode || '-'}</span>;
    },
    [pairInfo, bankOf, symOf],
  );

  return {
    ratioRows,
    ratioPending: ratioQuery.isPending,
    refetchRatios: () => void ratioQuery.refetch(),
    symOf,
    bankOf,
    pairInfo,
    decOf,
    renderPairX,
  };
}

/* ================================================================== */
/* 页面（含 ?statementNo= 详情分支）                                    */
/* ================================================================== */

export function SplitSettlePage() {
  const searchParams = useSearchParams();
  const statementNo = searchParams.get('statementNo')?.trim() ?? '';
  // 无 hooks 早退：详情视图为独立子组件（hooks 互不影响）
  if (statementNo) return <StatementDetailView orderKey={statementNo} />;
  return <SplitSettleMain />;
}

/**
 * 独立结算单详情出口（同参 ?statementNo=；registry 后续接 `detail`
 * pageKey 时可直接复用）。
 */
export function SettlementStatementDetailPage() {
  const searchParams = useSearchParams();
  const statementNo = searchParams.get('statementNo')?.trim() ?? '';
  if (!statementNo) return <StatementNotFound />;
  return <StatementDetailView orderKey={statementNo} />;
}

function StatementNotFound() {
  const router = useRouter();
  return (
    <section className="rounded-lg border border-border/60 bg-card p-8 text-center">
      <h2 className="text-lg font-semibold">Settlement Statement not found</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        This settlement statement does not exist or has been removed.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={() => router.push(LIST_ROUTE)}
      >
        <ArrowLeft className="mr-1.5 size-3.5" aria-hidden="true" />
        Back to Settlement Statements
      </Button>
    </section>
  );
}

/* ── 主视图（三页签） ─────────────────────────────────────────────── */

function SplitSettleMain() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get('tab') ?? '';
  const activeTab: SplitTab = (TAB_VALUES as readonly string[]).includes(
    rawTab,
  )
    ? (rawTab as SplitTab)
    : 'details';

  const ctx = usePairContext();

  // ===== Revenue Share Details（分页 + 服务端筛选；查询常驻挂载） =====
  const detailForm = useForm<DetailFilterForm>({
    defaultValues: EMPTY_DETAIL_FILTER,
  });
  const [detailParams, setDetailParams] = React.useState<DetailParams>({
    pageNum: 1,
  });
  const detailQuery = useSplitDetailQuery(PROJECT_ID, {
    pageNum: detailParams.pageNum,
    pageSize: PAGE_SIZE,
    filter: {
      pairCode: detailParams.pairCode,
      startTime: detailParams.startTime,
      endTime: detailParams.endTime,
    },
  });
  const detailRows = detailQuery.data?.rows ?? [];
  const detailTotal = detailQuery.data?.total ?? 0;

  // ===== Settlement Statements（分页 + 服务端筛选；查询常驻挂载） =====
  const ordersForm = useForm<OrdersFilterForm>({
    defaultValues: EMPTY_ORDERS_FILTER,
  });
  const [ordersParams, setOrdersParams] = React.useState<OrdersParams>({
    pageNum: 1,
  });
  const ordersQuery = useSettleOrdersQuery(PROJECT_ID, {
    pageNum: ordersParams.pageNum,
    pageSize: PAGE_SIZE,
    filter: {
      periodType: ordersParams.periodType,
      status: ordersParams.status,
    },
  });
  const orderRows = ordersQuery.data?.data ?? [];
  const ordersTotal = ordersQuery.data?.pagination.total ?? 0;

  function refreshAll() {
    ctx.refetchRatios();
    void detailQuery.refetch();
    void ordersQuery.refetch();
  }

  // Token Pair 筛选选项：卡1 参与行派生（SYM → SYM）
  const pairOptions = React.useMemo<SelectOption[]>(
    () =>
      ctx.ratioRows
        .filter((r) => r.pairCode)
        .map((r) => ({
          value: r.pairCode as string,
          label: `${ctx.symOf(r.sourceTokenCode)} → ${ctx.symOf(r.targetTokenCode)}`,
        })),
    [ctx.ratioRows, ctx.symOf],
  );

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* 页头 + 单一刷新（pair/rate 刷比例卡，settle_order 刷结算单；01 §E6） */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {LBL.eyebrow}
            </div>
            <h1 className="text-xl font-semibold">{LBL.title}</h1>
          </div>
          <div className="shrink-0">
            <SyncRefreshButton
              domain={['pair', 'rate', 'settle_order']}
              onRefreshed={refreshAll}
            />
          </div>
        </div>

        {/* 汇总条（GAP-LP-01 静态补齐） */}
        <section className="grid gap-4 sm:grid-cols-3">
          <SummaryCell label="My Share (MTD)">
            {SUMMARY_SHARE_MTD_FALLBACK.amount}
            <span className="ml-1.5 text-sm font-semibold text-muted-foreground">
              {SUMMARY_SHARE_MTD_FALLBACK.token}
            </span>
          </SummaryCell>
          <SummaryCell label="Next cycle">
            {shortCycleLabel(SUMMARY_NEXT_CYCLE_END_FALLBACK)}
          </SummaryCell>
          <SummaryCell label="Pending Confirmation">
            {SUMMARY_PENDING_CONFIRMATION_FALLBACK}
          </SummaryCell>
        </section>

        {/* 页签（?tab= replace 切换；标签带计数） */}
        <Tabs
          value={activeTab}
          onValueChange={(v) =>
            router.replace({ pathname: LIST_ROUTE, query: { tab: v } })
          }
        >
          <TabsList>
            <TabsTrigger value="effective">
              {LBL.tabEffective}
              <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                {ctx.ratioRows.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="details">
              {LBL.tabDetails}
              <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                {detailTotal}
              </span>
            </TabsTrigger>
            <TabsTrigger value="statements">
              {LBL.tabStatements}
              <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                {ordersTotal}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === 'effective' && <EffectiveTabSection ctx={ctx} />}
        {activeTab === 'details' && (
          <DetailsTabSection
            rows={detailRows}
            total={detailTotal}
            isLoading={detailQuery.isPending}
            isFiltered={
              detailParams.pairCode != null ||
              detailParams.startTime != null ||
              detailParams.endTime != null
            }
            pageNum={detailParams.pageNum}
            onPageChange={(page) =>
              setDetailParams((prev) => ({ ...prev, pageNum: page }))
            }
            form={detailForm}
            onSubmitFilter={(f) =>
              setDetailParams({
                pageNum: 1,
                pairCode: f.pairCode !== ALL ? f.pairCode : undefined,
                startTime: f.startTime
                  ? new Date(f.startTime).getTime()
                  : undefined,
                endTime: f.endTime ? new Date(f.endTime).getTime() : undefined,
              })
            }
            onResetFilter={() => {
              detailForm.reset(EMPTY_DETAIL_FILTER);
              setDetailParams({ pageNum: 1 });
            }}
            pairOptions={pairOptions}
            ctx={ctx}
          />
        )}
        {activeTab === 'statements' && (
          <StatementsTabSection
            rows={orderRows}
            total={ordersTotal}
            isLoading={ordersQuery.isPending}
            isFiltered={
              ordersParams.periodType != null || ordersParams.status != null
            }
            pageNum={ordersParams.pageNum}
            onPageChange={(page) =>
              setOrdersParams((prev) => ({ ...prev, pageNum: page }))
            }
            form={ordersForm}
            onSubmitFilter={(f) =>
              setOrdersParams({
                pageNum: 1,
                periodType:
                  f.periodType !== ALL ? Number(f.periodType) : undefined,
                status: f.status !== ALL ? Number(f.status) : undefined,
              })
            }
            onResetFilter={() => {
              ordersForm.reset(EMPTY_ORDERS_FILTER);
              setOrdersParams({ pageNum: 1 });
            }}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

/* ── 页签 1：Effective Revenue Shares（pair 域全量；本地排序即全量） ── */

function EffectiveTabSection({ ctx }: { ctx: PairContext }) {
  const { symOf, bankOf } = ctx;

  const tableData = React.useMemo(
    () => ctx.ratioRows.map((r) => ({ ...r, id: String(r.pairId) })),
    [ctx.ratioRows],
  );

  type RatioListRow = SplitRow & { id: string };
  const sortGetters = React.useMemo<
    Record<string, ProtoSortGetter<RatioListRow>>
  >(
    () => ({
      pair: {
        value: (r) =>
          `${symOf(r.sourceTokenCode)} → ${symOf(r.targetTokenCode)}`,
      },
      settlementToken: { value: (r) => symOf(r.sourceTokenCode) },
      baseRate: { value: (r) => numOf(r.baseRate) },
      markupRate: { value: (r) => numOf(r.markupRate) },
      clientRate: { value: (r) => numOf(r.userRate) },
      standard: { value: (r) => numOf(r.defaultSplitRatio) },
      my: { value: (r) => numOf(r.mySplitRatio) },
      status: { value: (r) => LP_PAIR_STATUS_MAP[r.status]?.rank ?? 99 },
      syncTime: { value: (r) => r.syncTime || null, defaultDir: 'desc' },
    }),
    [symOf],
  );
  const { sorted, toggle, sortState } = useProtoSort(
    tableData,
    sortGetters,
    'pair',
    'asc',
  );

  const columns = React.useMemo<ColumnDef<RatioListRow>[]>(
    () => [
      {
        id: 'tokenPair',
        header: () => (
          <ProtoSortHeader
            label="Token Pair"
            columnKey="pair"
            toggle={toggle}
            sortState={sortState('pair')}
          />
        ),
        cell: ({ row }) => (
          <PairX
            source={row.original.sourceTokenCode}
            target={row.original.targetTokenCode}
            bankOf={bankOf}
            symOf={symOf}
          />
        ),
      },
      {
        // 结算币种：symOf(sourceTokenCode) plain tag
        id: 'currency',
        header: () => (
          <ProtoSortHeader
            label="Settlement Token"
            columnKey="settlementToken"
            toggle={toggle}
            sortState={sortState('settlementToken')}
          />
        ),
        cell: ({ row }) => (
          <Badge variant="outline" className="font-mono">
            {symOf(row.original.sourceTokenCode)}
          </Badge>
        ),
      },
      {
        // Base Rate：系统配置口径（ⓘ 提示语原型逐字）
        accessorKey: 'baseRate',
        header: () => (
          <div className="flex items-center justify-end gap-1">
            <ProtoSortHeader
              label="Base Rate"
              columnKey="baseRate"
              toggle={toggle}
              sortState={sortState('baseRate')}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <CircleHelp
                  className="size-3.5 cursor-help text-muted-foreground"
                  aria-label="Base Rate explanation"
                />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {LBL.baseRateHint}
              </TooltipContent>
            </Tooltip>
          </div>
        ),
        cell: ({ row }) => (
          <span className="block text-right font-mono text-xs tabular-nums">
            {formatRate(row.original.baseRate)}
          </span>
        ),
      },
      {
        accessorKey: 'markupRate',
        header: () => (
          <div className="flex justify-end">
            <ProtoSortHeader
              label="Markup Rate"
              columnKey="markupRate"
              toggle={toggle}
              sortState={sortState('markupRate')}
            />
          </div>
        ),
        cell: ({ row }) => (
          <span className="block text-right font-mono text-xs tabular-nums">
            {percentOf(row.original.markupRate)}
          </span>
        ),
      },
      {
        accessorKey: 'userRate',
        header: () => (
          <div className="flex justify-end">
            <ProtoSortHeader
              label="Client Rate"
              columnKey="clientRate"
              toggle={toggle}
              sortState={sortState('clientRate')}
            />
          </div>
        ),
        cell: ({ row }) => (
          <span className="block text-right font-mono text-xs tabular-nums">
            {formatRate(row.original.userRate)}
          </span>
        ),
      },
      {
        accessorKey: 'defaultSplitRatio',
        header: () => (
          <div className="flex justify-end">
            <ProtoSortHeader
              label="Standard Share"
              columnKey="standard"
              toggle={toggle}
              sortState={sortState('standard')}
            />
          </div>
        ),
        cell: ({ row }) => (
          <span className="block text-right font-mono text-xs tabular-nums">
            {percentOf(row.original.defaultSplitRatio)}
          </span>
        ),
      },
      {
        accessorKey: 'mySplitRatio',
        header: () => (
          <div className="flex justify-end">
            <ProtoSortHeader
              label="My Share"
              columnKey="my"
              toggle={toggle}
              sortState={sortState('my')}
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1.5">
            <span className="font-mono text-xs tabular-nums">
              {percentOf(row.original.mySplitRatio)}
            </span>
            {row.original.overridden && (
              // 源 el-tag type=warning「覆盖」；outline+amber 警示层先例
              <Badge
                variant="outline"
                className="shrink-0 border-amber-300 bg-amber-50 text-amber-900"
              >
                Overridden
              </Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: () => (
          <ProtoSortHeader
            label="Status"
            columnKey="status"
            toggle={toggle}
            sortState={sortState('status')}
          />
        ),
        cell: ({ row }) => <PairStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'syncTime',
        header: () => (
          <ProtoSortHeader
            label="Synced on"
            columnKey="syncTime"
            toggle={toggle}
            sortState={sortState('syncTime')}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {formatUtc8(row.original.syncTime)}
          </span>
        ),
      },
    ],
    [toggle, sortState, symOf, bankOf],
  );

  return (
    <section className="rounded-lg border border-border/60 bg-card p-4">
      <DataTable
        columns={columns}
        data={sorted}
        isLoading={ctx.ratioPending}
        emptyMessage={LBL.emptyEffective}
      />
    </section>
  );
}

/* ── 页签 2：Revenue Share Details（分页 + 服务端筛选） ────────────── */

function DetailsTabSection({
  rows,
  total,
  isLoading,
  isFiltered,
  pageNum,
  onPageChange,
  form,
  onSubmitFilter,
  onResetFilter,
  pairOptions,
  ctx,
}: {
  rows: SplitDetailRow[];
  total: number;
  isLoading: boolean;
  isFiltered: boolean;
  pageNum: number;
  onPageChange: (page: number) => void;
  form: UseFormReturn<DetailFilterForm>;
  onSubmitFilter: (f: DetailFilterForm) => void;
  onResetFilter: () => void;
  pairOptions: SelectOption[];
  ctx: PairContext;
}) {
  const tableData = React.useMemo(
    // 行 VO 无独立 ID 字段：只读表以行序作 row key（无重排/删除场景）
    () => rows.map((r, i) => ({ ...r, id: String(i) })),
    [rows],
  );

  type DetailListRow = SplitDetailRow & { id: string };
  // GAP-LP-05：/lp/split/detail 无服务端排序参数——本地排序仅当前页有效。
  const sortGetters = React.useMemo<
    Record<string, ProtoSortGetter<DetailListRow>>
  >(
    () => ({
      txNo: { value: (r) => txNoText(r) },
      tokenPair: { value: (r) => r.pairCode || null },
      token: { value: (r) => r.currency || null },
      principal: { value: (r) => numOf(r.principal) },
      markup: { value: (r) => numOf(r.markupAmount) },
      revenueShare: { value: (r) => numOf(r.splitRatio) },
      myShare: { value: (r) => numOf(r.lpSplitAmount) },
      completedTime: { value: (r) => r.completedTime || null, defaultDir: 'desc' },
    }),
    [],
  );
  const { sorted, toggle, sortState } = useProtoSort(
    tableData,
    sortGetters,
    'completedTime',
    'desc',
  );

  /**
   * GAP-LP-07：服务端 summary.markupTotal/lpSplitTotal 跨币种直接加总，
   * 口径失真弃用；改按当前页明细行 currency 分组合计（仅当前页，
   * 过渡口径同 GAP-LP-05）。小数位取该组任一行 pairCode 的源 token 精度。
   */
  const detailTotals = React.useMemo(() => {
    const groups = new Map<
      string,
      { markup: number; share: number; dec: number }
    >();
    for (const r of rows) {
      const key = r.currency || '-';
      const g =
        groups.get(key) ??
        { markup: 0, share: 0, dec: ctx.decOf(r.pairCode) };
      g.markup += numOf(r.markupAmount) ?? 0;
      g.share += numOf(r.lpSplitAmount) ?? 0;
      groups.set(key, g);
    }
    return [...groups.entries()].map(([currency, v]) => ({
      currency,
      ...v,
    }));
  }, [rows, ctx]);

  const columns = React.useMemo<ColumnDef<DetailListRow>[]>(
    () => [
      {
        accessorKey: 'txNo',
        header: () => (
          <ProtoSortHeader
            label="Transaction No."
            columnKey="txNo"
            toggle={toggle}
            sortState={sortState('txNo')}
          />
        ),
        cell: ({ row }) => {
          const no = txNoText(row.original);
          return no === '-' ? (
            <span className="font-mono text-xs text-muted-foreground">-</span>
          ) : (
            <CopyableId value={no} className="font-mono text-xs" />
          );
        },
      },
      {
        id: 'tokenPair',
        header: () => (
          <ProtoSortHeader
            label="Token Pair"
            columnKey="tokenPair"
            toggle={toggle}
            sortState={sortState('tokenPair')}
          />
        ),
        cell: ({ row }) => ctx.renderPairX(row.original.pairCode),
      },
      {
        accessorKey: 'currency',
        header: () => (
          <ProtoSortHeader
            label="Token"
            columnKey="token"
            toggle={toggle}
            sortState={sortState('token')}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.currency || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'principal',
        header: () => (
          <div className="flex justify-end">
            <ProtoSortHeader
              label="Principal"
              columnKey="principal"
              toggle={toggle}
              sortState={sortState('principal')}
            />
          </div>
        ),
        cell: ({ row }) => (
          <MoneyRight
            v={row.original.principal}
            dec={ctx.decOf(row.original.pairCode)}
          />
        ),
      },
      {
        // 原 Markup Amount → Markup（原型列名）
        accessorKey: 'markupAmount',
        header: () => (
          <div className="flex justify-end">
            <ProtoSortHeader
              label="Markup"
              columnKey="markup"
              toggle={toggle}
              sortState={sortState('markup')}
            />
          </div>
        ),
        cell: ({ row }) => (
          <MoneyRight
            v={row.original.markupAmount}
            dec={ctx.decOf(row.original.pairCode)}
          />
        ),
      },
      {
        // 原 Split Ratio → Revenue Share（原型列名）
        accessorKey: 'splitRatio',
        header: () => (
          <div className="flex justify-end">
            <ProtoSortHeader
              label="Revenue Share"
              columnKey="revenueShare"
              toggle={toggle}
              sortState={sortState('revenueShare')}
            />
          </div>
        ),
        cell: ({ row }) => (
          <span className="block text-right font-mono text-xs tabular-nums">
            {percentOf(row.original.splitRatio)}
          </span>
        ),
      },
      {
        accessorKey: 'lpSplitAmount',
        header: () => (
          <div className="flex justify-end">
            <ProtoSortHeader
              label="My Share"
              columnKey="myShare"
              toggle={toggle}
              sortState={sortState('myShare')}
            />
          </div>
        ),
        cell: ({ row }) => (
          <KeyFigureRight
            v={row.original.lpSplitAmount}
            dec={ctx.decOf(row.original.pairCode)}
          />
        ),
      },
      {
        accessorKey: 'completedTime',
        header: () => (
          <ProtoSortHeader
            label="Completed on"
            columnKey="completedTime"
            toggle={toggle}
            sortState={sortState('completedTime')}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {formatUtc8(row.original.completedTime)}
          </span>
        ),
      },
    ],
    [toggle, sortState, ctx],
  );

  return (
    <section className="rounded-lg border border-border/60 bg-card">
      {/* 工具条：Token Pair（卡1 参与行派生）+ 完成时间窗（服务端筛选） */}
      <form
        onSubmit={form.handleSubmit(onSubmitFilter)}
        className="border-b border-border/50 px-4 py-3"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FormSelect
            name="pairCode"
            control={form.control}
            label="Token Pair"
            options={[
              { value: ALL, label: 'All Token Pairs' },
              ...pairOptions,
            ]}
          />
          <FormField
            name="detailStartTime"
            label="Completed From"
            type="datetime-local"
            register={form.register('startTime')}
          />
          <FormField
            name="detailEndTime"
            label="Completed To"
            type="datetime-local"
            register={form.register('endTime')}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="submit">{LBL.query}</Button>
          <Button type="button" variant="outline" onClick={onResetFilter}>
            {LBL.reset}
          </Button>
        </div>
      </form>
      <div className="p-4">
        {/* GAP-LP-07 汇总行：{N} entries + 按币种分组 Markup/My share 合计 */}
        {detailTotals.length > 0 && (
          <div className="mb-3 flex flex-col gap-1 text-xs text-muted-foreground">
            <span className="tabular-nums">{total} entries</span>
            {detailTotals.map((t) => (
              <span key={t.currency} className="tabular-nums">
                {t.currency} · Markup total:{' '}
                {formatTokenAmount(t.markup, t.dec)} · My share:{' '}
                {formatTokenAmount(t.share, t.dec)}
              </span>
            ))}
          </div>
        )}
        <DataTable
          columns={columns}
          data={sorted}
          isLoading={isLoading}
          emptyMessage={
            isFiltered ? LBL.emptyDetailsFiltered : LBL.emptyDetails
          }
          pagination={{
            page: pageNum,
            pageSize: PAGE_SIZE,
            total,
            onPageChange,
            pageSizeOptions: [PAGE_SIZE],
          }}
        />
      </div>
    </section>
  );
}

/* ── 页签 3：Settlement Statements（分页 + 服务端筛选） ────────────── */

function StatementsTabSection({
  rows,
  total,
  isLoading,
  isFiltered,
  pageNum,
  onPageChange,
  form,
  onSubmitFilter,
  onResetFilter,
}: {
  rows: SettleOrderRow[];
  total: number;
  isLoading: boolean;
  isFiltered: boolean;
  pageNum: number;
  onPageChange: (page: number) => void;
  form: UseFormReturn<OrdersFilterForm>;
  onSubmitFilter: (f: OrdersFilterForm) => void;
  onResetFilter: () => void;
}) {
  const router = useRouter();

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.orderId) })),
    [rows],
  );

  type OrderListRow = SettleOrderRow & { id: string };
  // GAP-LP-05：/lp/settle/orders 无服务端排序参数——本地排序仅当前页有效；
  // 默认 Statement No. 倒序。
  const sortGetters = React.useMemo<
    Record<string, ProtoSortGetter<OrderListRow>>
  >(
    () => ({
      statementNo: { value: (r) => r.orderId, defaultDir: 'desc' },
      cycle: { value: (r) => PERIOD_RANK[r.periodType] ?? 99 },
      status: { value: (r) => LP_STATEMENT_STATUS_MAP[r.status]?.rank ?? 99 },
    }),
    [],
  );
  const { sorted, toggle, sortState } = useProtoSort(
    tableData,
    sortGetters,
    'statementNo',
    'desc',
  );

  const columns = React.useMemo<ColumnDef<OrderListRow>[]>(
    () => [
      {
        // GAP-LP-12：orderId 实为结算单号 → Statement No.
        accessorKey: 'orderId',
        header: () => (
          <ProtoSortHeader
            label="Statement No."
            columnKey="statementNo"
            toggle={toggle}
            sortState={sortState('statementNo')}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold">
            {row.original.orderId}
          </span>
        ),
      },
      {
        // GAP-LP-12：periodType → Settlement Cycle（未知码显原值）
        accessorKey: 'periodType',
        header: () => (
          <ProtoSortHeader
            label="Settlement Cycle"
            columnKey="cycle"
            toggle={toggle}
            sortState={sortState('cycle')}
          />
        ),
        cell: ({ row }) => (
          <span>
            {SETTLE_PERIOD_TYPE_LABEL[row.original.periodType] ??
              row.original.periodType}
          </span>
        ),
      },
      {
        // GAP-LP-12：periodStart/End → Period Range（UTC+8，X to Y）
        accessorKey: 'periodStart',
        header: 'Period Range',
        cell: ({ row }) => (
          <span className="block min-w-[320px] whitespace-nowrap font-mono text-xs tabular-nums">
            {formatUtc8(row.original.periodStart)} to{' '}
            {formatUtc8(row.original.periodEnd)}
          </span>
        ),
      },
      {
        // GAP-LP-12：currencies → Tokens（跨币种金额不可加总故仅列集合）
        accessorKey: 'currencies',
        header: 'Tokens',
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.currencies || '-'}
          </span>
        ),
      },
      {
        // GAP-LP-12：txCount → Transactions
        accessorKey: 'txCount',
        header: () => <div className="text-right">Transactions</div>,
        cell: ({ row }) => (
          <span className="block text-right font-mono text-xs tabular-nums">
            {row.original.txCount}
          </span>
        ),
      },
      {
        // GAP-LP-12：后端无 generatedAt（syncTime 为数据同步时间，非出单
        // 时间）→ 显 '-'；后端补字段后切换。
        id: 'generatedOn',
        header: 'Generated on',
        cell: () => <span className="text-muted-foreground">-</span>,
      },
      {
        accessorKey: 'status',
        header: () => (
          <ProtoSortHeader
            label="Status"
            columnKey="status"
            toggle={toggle}
            sortState={sortState('status')}
          />
        ),
        cell: ({ row }) => (
          <StatementStatusBadge status={row.original.status} />
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <Button
            variant="link"
            size="sm"
            className="h-auto whitespace-nowrap p-0"
            onClick={() => {
              const key = String(row.original.orderId);
              stashOrderRow(key, row.original);
              router.push({
                pathname: LIST_ROUTE,
                query: { statementNo: key },
              });
            }}
          >
            {LBL.detail}
          </Button>
        ),
      },
    ],
    [toggle, sortState, router],
  );

  return (
    <section className="rounded-lg border border-border/60 bg-card">
      {/* 工具条：周期粒度 + 状态（服务端筛选；v2.4 wire 数字码） */}
      <form
        onSubmit={form.handleSubmit(onSubmitFilter)}
        className="border-b border-border/50 px-4 py-3"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FormSelect
            name="periodType"
            control={form.control}
            label="Settlement Cycle"
            options={[{ value: ALL, label: 'All' }, ...PERIOD_OPTIONS]}
          />
          <FormSelect
            name="status"
            control={form.control}
            label="Status"
            options={[
              { value: ALL, label: 'All' },
              ...STATEMENT_STATUS_OPTIONS,
            ]}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="submit">{LBL.query}</Button>
          <Button type="button" variant="outline" onClick={onResetFilter}>
            {LBL.reset}
          </Button>
        </div>
      </form>
      <div className="p-4">
        <DataTable
          columns={columns}
          data={sorted}
          isLoading={isLoading}
          emptyMessage={
            isFiltered ? LBL.emptyStatementsFiltered : LBL.emptyStatements
          }
          pagination={{
            page: pageNum,
            pageSize: PAGE_SIZE,
            total,
            onPageChange,
            pageSizeOptions: [PAGE_SIZE],
          }}
        />
      </div>
    </section>
  );
}

/* ── 结算单详情视图（暂存行 + items + 本单流水） ───────────────────── */

function StatementDetailView({ orderKey }: { orderKey: string }) {
  const router = useRouter();

  // 暂存行读取收进 effect（SSR 首帧与客户端一致，避免 hydration 错位）
  const [order, setOrder] = React.useState<SettleOrderRow | null>(null);
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    setOrder(peekOrderRow(orderKey));
    setReady(true);
  }, [orderKey]);

  // 本单周期流水（POST /settle/order-records 按 orderId；失败静默——拦截器已提示）
  const recordsQuery = useSettleOrderRecordsQuery(
    PROJECT_ID,
    order?.orderId ?? null,
  );
  const records = recordsQuery.data ?? [];

  const ctx = usePairContext();

  // hooks 结束后的条件渲染
  if (!ready) return <DetailSkeleton />;
  if (!order) return <StatementNotFound />;

  return (
    <div className="space-y-4">
      {/* 页头：返回 + 标题/状态 + 单号/生成时间（GAP-LP-12：Generated on 无源） */}
      <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="mt-0.5 h-8 w-8 shrink-0"
            aria-label="Back to Settlement Statements"
            onClick={() => router.push(LIST_ROUTE)}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {LBL.eyebrow}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">
                Settlement Statement {order.orderId}
              </h1>
              <StatementStatusBadge status={order.status} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="tabular-nums">
                Statement No.: {order.orderId}
              </span>
              <span aria-hidden="true">|</span>
              <span>Generated on -</span>
            </div>
          </div>
        </div>
      </section>

      {/* Statement Information（GAP-LP-12 文案映射） */}
      <section className="rounded-lg border border-border/60 bg-card">
        <div className="border-b border-border/50 px-4 py-3">
          <div className="text-base font-semibold leading-6 text-foreground">
            Statement Information
          </div>
        </div>
        <div className="p-4">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Item label="Settlement Cycle">
              {SETTLE_PERIOD_TYPE_LABEL[order.periodType] ?? order.periodType}
            </Item>
            <Item label="Period Range">
              <span className="font-mono text-xs tabular-nums">
                {formatUtc8(order.periodStart)} to {formatUtc8(order.periodEnd)}
              </span>
            </Item>
            <Item label="Tokens">
              <span className="font-mono text-xs">
                <Dash value={order.currencies} />
              </span>
            </Item>
            <Item label="Transactions">
              <span className="font-mono text-sm font-medium tabular-nums">
                {order.txCount}
              </span>
            </Item>
          </dl>
        </div>
      </section>

      {/* Revenue Share by Token Pair（分项直读 row.items；三态本地排序） */}
      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-1 border-b border-border/50 px-4 py-3">
          <div className="text-base font-semibold leading-6 text-foreground">
            Revenue Share by Token Pair
          </div>
          <div className="text-xs leading-5 text-muted-foreground">
            {LBL.itemsHint}
          </div>
        </div>
        <div className="p-4">
          <ItemsTable items={order.items ?? []} ctx={ctx} />
        </div>
      </section>

      {/* Settlement Records (this period)（独立端点按 orderId 拉取） */}
      <section className="rounded-lg border border-border/60 bg-card">
        <div className="border-b border-border/50 px-4 py-3">
          <div className="text-base font-semibold leading-6 text-foreground">
            Settlement Records (this period)
          </div>
        </div>
        <div className="p-4">
          {recordsQuery.isPending ? (
            <div className="space-y-2" aria-label="Loading">
              <div className="h-8 w-full motion-safe:animate-pulse rounded bg-muted" />
              <div className="h-8 w-full motion-safe:animate-pulse rounded bg-muted" />
            </div>
          ) : (
            <RecordsTable rows={records} ctx={ctx} />
          )}
        </div>
      </section>
    </div>
  );
}

/* ── 详情两张子表 ─────────────────────────────────────────────────── */

/** Token 对分项表（直读 row.items 非二次请求；6 列；三态本地排序）。 */
function ItemsTable({
  items,
  ctx,
}: {
  items: SettleOrderItem[];
  ctx: PairContext;
}) {
  const tableData = React.useMemo(
    () => items.map((it, i) => ({ ...it, id: String(i) })),
    [items],
  );

  type ItemListRow = SettleOrderItem & { id: string };
  // GAP-LP-05 同款过渡口径：items 为单内全量分项，本地排序即全量。
  const sortGetters = React.useMemo<
    Record<string, ProtoSortGetter<ItemListRow>>
  >(
    () => ({
      pair: { value: (r) => r.pairCode || null },
      token: { value: (r) => r.currency || null },
      count: { value: (r) => r.txCount, defaultDir: 'desc' },
      principal: { value: (r) => numOf(r.principalTotal) },
      markup: { value: (r) => numOf(r.markupTotal) },
      myShare: { value: (r) => numOf(r.lpSplitTotal) },
    }),
    [],
  );
  // 三态：desc → asc → 自然序（原型分项表口径）；起始自然序
  const { sorted, toggle, sortState } = useProtoSort(
    tableData,
    sortGetters,
    null,
    'desc',
    true,
  );

  const columns = React.useMemo<ColumnDef<ItemListRow>[]>(
    () => [
      {
        id: 'tokenPair',
        header: () => (
          <ProtoSortHeader
            label="Token Pair"
            columnKey="pair"
            toggle={toggle}
            sortState={sortState('pair')}
          />
        ),
        cell: ({ row }) => ctx.renderPairX(row.original.pairCode),
      },
      {
        accessorKey: 'currency',
        header: () => (
          <ProtoSortHeader
            label="Token"
            columnKey="token"
            toggle={toggle}
            sortState={sortState('token')}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.currency || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'txCount',
        header: () => (
          <div className="flex justify-end">
            <ProtoSortHeader
              label="Count"
              columnKey="count"
              toggle={toggle}
              sortState={sortState('count')}
            />
          </div>
        ),
        cell: ({ row }) => (
          <span className="block text-right font-mono text-xs tabular-nums">
            {row.original.txCount}
          </span>
        ),
      },
      {
        accessorKey: 'principalTotal',
        header: () => (
          <div className="flex justify-end">
            <ProtoSortHeader
              label="Principal"
              columnKey="principal"
              toggle={toggle}
              sortState={sortState('principal')}
            />
          </div>
        ),
        cell: ({ row }) => (
          <MoneyRight
            v={row.original.principalTotal}
            dec={ctx.decOf(row.original.pairCode)}
          />
        ),
      },
      {
        accessorKey: 'markupTotal',
        header: () => (
          <div className="flex justify-end">
            <ProtoSortHeader
              label="Markup"
              columnKey="markup"
              toggle={toggle}
              sortState={sortState('markup')}
            />
          </div>
        ),
        cell: ({ row }) => (
          <MoneyRight
            v={row.original.markupTotal}
            dec={ctx.decOf(row.original.pairCode)}
          />
        ),
      },
      {
        accessorKey: 'lpSplitTotal',
        header: () => (
          <div className="flex justify-end">
            <ProtoSortHeader
              label="My Share"
              columnKey="myShare"
              toggle={toggle}
              sortState={sortState('myShare')}
            />
          </div>
        ),
        cell: ({ row }) => (
          <KeyFigureRight
            v={row.original.lpSplitTotal}
            dec={ctx.decOf(row.original.pairCode)}
          />
        ),
      },
    ],
    [toggle, sortState, ctx],
  );

  return (
    <DataTable
      columns={columns}
      data={sorted}
      isLoading={false}
      emptyMessage={LBL.emptyItems}
    />
  );
}

/** 结算流水表（本单周期内；POST /settle/order-records；7 列）。 */
function RecordsTable({
  rows,
  ctx,
}: {
  rows: SettleRecordRow[];
  ctx: PairContext;
}) {
  const columns = React.useMemo<ColumnDef<SettleRecordRow & { id: string }>[]>(
    () => [
      {
        accessorKey: 'txNo',
        header: 'Tx No.',
        cell: ({ row }) => {
          const no = txNoText(row.original);
          return no === '-' ? (
            <span className="font-mono text-xs text-muted-foreground">-</span>
          ) : (
            <CopyableId value={no} className="font-mono text-xs" />
          );
        },
      },
      {
        id: 'tokenPair',
        header: 'Token Pair',
        cell: ({ row }) => ctx.renderPairX(row.original.pairCode),
      },
      {
        accessorKey: 'currency',
        header: 'Token',
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.currency || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'principal',
        header: () => <div className="text-right">Principal</div>,
        cell: ({ row }) => (
          <MoneyRight
            v={row.original.principal}
            dec={ctx.decOf(row.original.pairCode)}
          />
        ),
      },
      {
        accessorKey: 'markupAmount',
        header: () => <div className="text-right">Markup</div>,
        cell: ({ row }) => (
          <MoneyRight
            v={row.original.markupAmount}
            dec={ctx.decOf(row.original.pairCode)}
          />
        ),
      },
      {
        accessorKey: 'lpSplitAmount',
        header: () => <div className="text-right">My Share</div>,
        cell: ({ row }) => (
          <KeyFigureRight
            v={row.original.lpSplitAmount}
            dec={ctx.decOf(row.original.pairCode)}
          />
        ),
      },
      {
        accessorKey: 'completedTime',
        header: 'Completed on',
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {formatUtc8(row.original.completedTime)}
          </span>
        ),
      },
    ],
    [ctx],
  );

  const data = React.useMemo(
    () => rows.map((r, i) => ({ ...r, id: String(i) })),
    [rows],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={false}
      emptyMessage={LBL.emptyRecords}
    />
  );
}
