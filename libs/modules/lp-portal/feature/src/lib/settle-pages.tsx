'use client';

/**
 * Settlement page (doc 01 section D10, semantic port of legacy
 * `src/views/settle/index.vue`).
 *
 * Behavior contract:
 * - Dual tabs - Settlement Records / Settlement Orders - each tab owns its
 *   own filter form, submitted params, pagination and query cache. Both
 *   queries mount in parallel on page load; switching tabs never refires
 *   (cache hit, filters and page survive unmount of a panel).
 * - Domain refresh: SyncRefreshButton(domain='settle_order'). The settle
 *   sync domain covers settlement orders only, so the success callback
 *   refetches JUST the orders-tab query and leaves the records-tab cache
 *   untouched (doc 01 E6 trap).
 * - Orders status filter options derive mechanically from the shared
 *   code-table keys; unknown codes are still selectable-safe because badge
 *   rendering falls back to raw numbers without crashing.
 * - Period filter exposes the daily/weekly/monthly granularity; wire values
 *   use the API contract strings mapped to backend period_type 1/2/3.
 * - Records table is 7 columns (v2.3 e591f85): tx number `txNo || '-'` via
 *   the shared txNoText (mono, overflow tooltip) replaces the legacy
 *   record/tx id pair; the ratio snapshot is now declared on the row VO.
 * - Orders rows expose an operation link opening the token-pair breakdown
 *   dialog (720px max width) reading row items directly - no second
 *   request, empty state when items are absent, NO footer buttons. Items
 *   arrive as an optional JSON field not yet declared on SettleOrderRow,
 *   so access is defensive and renders '-' for missing cells.
 * - Money columns share one caliber (global formatMoney thousands grouping);
 *   my-split key figures keep their emphasized styling.
 * - Service-down (0024) merges both sides into one page-level banner while
 *   previously loaded rows stay on screen; non-0024 failures clear it.
 */
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { type ColumnDef } from '@tanstack/react-table';

import {
  Badge,
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@myorg/shared/ui';
import { FormField, FormSelect, type SelectOption } from '@myorg/shared/ui-forms';

import {
  LP_PROJECT_ID,
  SETTLE_ORDER_STATUS_LABEL,
  SETTLE_ORDER_STATUS_VARIANT,
  SETTLE_PERIOD_TYPE_LABEL,
  isServiceDown,
  useSettleOrdersQuery,
  useSettleRecordsQuery,
  txNoText,
  type SettleOrderRow,
  type SettleRecordRow,
} from '@myorg/modules/lp-portal/data-access';
import { formatMoney, formatTime } from './format';
import { SyncRefreshButton } from './sync-refresh-button';
import { ServiceDownAlert } from './service-down-alert';

/* ================================================================== */
/* Constants                                                           */
/* ================================================================== */

const PROJECT_ID = LP_PROJECT_ID;
/** Source el-pagination fixed page-size 10 (layout total, prev, pager, next). */
const PAGE_SIZE = 10;

const LBL = {
  eyebrow: 'BUSINESS',
  title: 'Settlement',
  tabRecords: 'Settlement Records',
  tabOrders: 'Settlement Orders',
  query: 'Search',
  reset: 'Reset',
  empty: 'No data',
  breakdown: 'Token Pair Breakdown',
  breakdownEmpty: 'No breakdown data',
} as const;

/** Dropdown all sentinel (FormSelect forbids empty values). */
const ALL = 'all';

/**
 * Orders status filter options derived from the shared code table. When the
 * table collapses two codes onto one label (5/10 -> Generated), the raw code
 * is appended so the dropdown stays unambiguous without inventing copy.
 */
function buildOrderStatusOptions(): SelectOption[] {
  const seen = new Set<string>();
  return [
    { value: ALL, label: 'All' },
    ...Object.keys(SETTLE_ORDER_STATUS_LABEL).map((k) => {
      const code = Number(k);
      const base = SETTLE_ORDER_STATUS_LABEL[code] ?? `${code}`;
      const label = seen.has(base) ? `${base} (${code})` : base;
      seen.add(base);
      return { value: k, label };
    }),
  ];
}

const ORDER_STATUS_OPTIONS = buildOrderStatusOptions();

/** Display granularity -> API contract wire value (backend maps period_type). */
const PERIOD_WIRE_VALUE: Record<number, 'day' | 'week' | 'month'> = {
  1: 'day',
  2: 'week',
  3: 'month',
};

const ORDER_CYCLE_OPTIONS: SelectOption[] = Object.keys(
  SETTLE_PERIOD_TYPE_LABEL,
)
  .map((k) => Number(k))
  .filter((code) => PERIOD_WIRE_VALUE[code] !== undefined)
  .map((code) => ({
    value: PERIOD_WIRE_VALUE[code],
    label: SETTLE_PERIOD_TYPE_LABEL[code],
  }));

/* ===== records tab (filters: completed-time range only) ===== */

interface RecordsFilterForm {
  startTime: string;
  endTime: string;
}

const EMPTY_RECORDS_FILTER: RecordsFilterForm = {
  startTime: '',
  endTime: '',
};

interface RecordsParams {
  pageNum: number;
  startTime?: number;
  endTime?: number;
}

function recordsFormToParams(
  f: RecordsFilterForm,
  pageNum = 1,
): RecordsParams {
  return {
    pageNum,
    startTime: f.startTime ? new Date(f.startTime).getTime() : undefined,
    endTime: f.endTime ? new Date(f.endTime).getTime() : undefined,
  };
}

/* ===== orders tab (status + period + time range) ===== */

interface OrdersFilterForm {
  status: string;
  cycle: string;
  startTime: string;
  endTime: string;
}

const EMPTY_ORDERS_FILTER: OrdersFilterForm = {
  status: ALL,
  cycle: ALL,
  startTime: '',
  endTime: '',
};

interface OrdersParams {
  pageNum: number;
  status?: number;
  cycle?: 'day' | 'week' | 'month';
  startTime?: number;
  endTime?: number;
}

function ordersFormToParams(f: OrdersFilterForm, pageNum = 1): OrdersParams {
  return {
    pageNum,
    status: f.status !== ALL ? Number(f.status) : undefined,
    cycle:
      f.cycle !== ALL ? (f.cycle as 'day' | 'week' | 'month') : undefined,
    startTime: f.startTime ? new Date(f.startTime).getTime() : undefined,
    endTime: f.endTime ? new Date(f.endTime).getTime() : undefined,
  };
}

/* ================================================================== */
/* Cell helpers                                                        */
/* ================================================================== */

/** Ratio (0..1 fraction or numeric string) with two decimals; blank stays '-'. */
function percentText(v: number | string | null | undefined): string {
  return v === null || v === undefined || v === ''
    ? '-'
    : `${(Number(v) * 100).toFixed(2)}%`;
}

/** Money cell: shared formatter (thousands grouping, backend decimals kept). */
function Money({ v }: { v: number | string }) {
  return (
    <span className="font-mono text-xs tabular-nums">{formatMoney(v)}</span>
  );
}

/** Key-figure emphasis for the my-split totals column. */
function KeyFigure({ v }: { v: number | string }) {
  return (
    <span className="font-mono text-xs font-semibold tabular-nums text-primary">
      {formatMoney(v)}
    </span>
  );
}

/** Period range text rendered from both boundary timestamps. */
function periodText(row: SettleOrderRow): string {
  return `${formatTime(row.periodStart)} – ${formatTime(row.periodEnd)}`;
}

/** Order status badge; unknown codes show the raw number on neutral tone. */
function OrderStatusBadge({ status }: { status: number }) {
  return (
    <Badge variant={SETTLE_ORDER_STATUS_VARIANT[status] ?? 'secondary'}>
      {SETTLE_ORDER_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

/* ================================================================== */
/* Order items (token-pair breakdown)                                  */
/* ================================================================== */

/**
 * Item shape tolerance: the field ships as JSON on the order VO but is not
 * yet part of the declared row type, so every cell is individually optional
 * and falls back to '-' instead of crashing.
 */
interface OrderItemVO {
  pairCode?: string | null;
  txCount?: number | null;
  principalTotal?: number | null;
  markupTotal?: number | null;
  lpSplitTotal?: number | null;
}

function readOrderItems(row: SettleOrderRow): OrderItemVO[] {
  const raw = (row as SettleOrderRow & { items?: unknown }).items;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is OrderItemVO =>
      x !== null && typeof x === 'object' && !Array.isArray(x),
  );
}

/**
 * Breakdown dialog body: five-item grid mirroring the legacy modal -
 * token pair / tx count / principal total / markup total / my split.
 * Purely presentational; no actions and no footer by design.
 */
function ItemsTable({ items }: { items: OrderItemVO[] }) {
  if (items.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        {LBL.breakdownEmpty}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="grid grid-cols-5 gap-px bg-border text-xs text-muted-foreground">
        <div className="bg-muted px-3 py-2">Token Pair</div>
        <div className="bg-muted px-3 py-2">Tx Count</div>
        <div className="bg-muted px-3 py-2">Principal Total</div>
        <div className="bg-muted px-3 py-2">Markup Total</div>
        <div className="bg-muted px-3 py-2">My Split</div>
      </div>
      <div className="grid grid-cols-5 gap-px bg-border text-sm">
        {items.map((it, i) => (
          <React.Fragment key={i}>
            <div className="bg-card px-3 py-2 font-mono text-xs">
              {it.pairCode || '-'}
            </div>
            <div className="bg-card px-3 py-2 font-mono text-xs tabular-nums">
              {it.txCount ?? '-'}
            </div>
            <div className="bg-card px-3 py-2">
              {it.principalTotal == null ? (
                '-'
              ) : (
                <Money v={it.principalTotal} />
              )}
            </div>
            <div className="bg-card px-3 py-2">
              {it.markupTotal == null ? '-' : <Money v={it.markupTotal} />}
            </div>
            <div className="bg-card px-3 py-2">
              {it.lpSplitTotal == null ? (
                '-'
              ) : (
                <KeyFigure v={it.lpSplitTotal} />
              )}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/* ================================================================== */
/* Page                                                                */
/* ================================================================== */

export function SettleListPage() {
  // ===== Settlement records =====
  const recordsForm = useForm<RecordsFilterForm>({
    defaultValues: EMPTY_RECORDS_FILTER,
  });
  const [recordsParams, setRecordsParams] = React.useState<RecordsParams>(() =>
    recordsFormToParams(EMPTY_RECORDS_FILTER),
  );

  const recordsQuery = useSettleRecordsQuery(PROJECT_ID, {
    pageNum: recordsParams.pageNum,
    pageSize: PAGE_SIZE,
    filter: {
      startTime: recordsParams.startTime,
      endTime: recordsParams.endTime,
    },
  });

  const recordRows = recordsQuery.data?.data ?? [];
  const recordsTotal = recordsQuery.data?.pagination.total ?? 0;

  // ===== Settlement orders =====
  const ordersForm = useForm<OrdersFilterForm>({
    defaultValues: EMPTY_ORDERS_FILTER,
  });
  const [ordersParams, setOrdersParams] = React.useState<OrdersParams>(() =>
    ordersFormToParams(EMPTY_ORDERS_FILTER),
  );

  const ordersQuery = useSettleOrdersQuery(PROJECT_ID, {
    pageNum: ordersParams.pageNum,
    pageSize: PAGE_SIZE,
    filter: {
      status: ordersParams.status,
      cycle: ordersParams.cycle,
      startTime: ordersParams.startTime,
      endTime: ordersParams.endTime,
    },
  });

  const orderRows = ordersQuery.data?.data ?? [];
  const ordersTotal = ordersQuery.data?.pagination.total ?? 0;

  // Breakdown dialog target; cleared on close to unmount.
  const [breakdownRow, setBreakdownRow] = React.useState<SettleOrderRow | null>(
    null,
  );

  // Page-level single banner: any side erroring with 0024 surfaces here;
  // clearing happens automatically once the failing side recovers.
  const down = React.useMemo(() => {
    for (const err of [recordsQuery.error, ordersQuery.error]) {
      if (err != null && isServiceDown(err)) return { traceId: err.traceId };
    }
    return null;
  }, [recordsQuery.error, ordersQuery.error]);

  /**
   * Domain refresh semantics (settle_order): only the settlement-orders
   * query refetches - the records-tab cache and its page stay untouched.
   */
  function refreshOrdersTab() {
    void ordersQuery.refetch();
  }

  const recordColumns = React.useMemo<
    ColumnDef<SettleRecordRow & { id: string }>[]
  >(
    () => [
      {
        // 交易单号：txNo||'-' 固定口径（共享 txNoText 勿自写分叉）；溢出
        // tooltip 对应源 min-w180 show-overflow-tooltip
        accessorKey: 'txNo',
        header: 'Tx No.',
        cell: ({ row }) => {
          const no = txNoText(row.original);
          return no === '-' ? (
            <span className="font-mono text-xs">-</span>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block max-w-[180px] truncate font-mono text-xs">
                  {no}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm break-all font-mono text-xs">
                {no}
              </TooltipContent>
            </Tooltip>
          );
        },
      },
      {
        accessorKey: 'pairCode',
        header: 'Token Pair',
        // 无码显 '-'（源 prop 直出列的空串占位等价）
        cell: ({ row }) => <span>{row.original.pairCode || '-'}</span>,
      },
      {
        accessorKey: 'principal',
        header: 'Principal',
        cell: ({ row }) => <Money v={row.original.principal} />,
      },
      {
        accessorKey: 'markupAmount',
        header: 'Markup Amount',
        cell: ({ row }) => <Money v={row.original.markupAmount} />,
      },
      {
        accessorKey: 'splitRatio',
        header: 'Split Ratio',
        cell: ({ row }) => (
          <span className="block font-mono text-xs tabular-nums">
            {percentText(row.original.splitRatio)}
          </span>
        ),
      },
      {
        accessorKey: 'lpSplitAmount',
        header: 'My Split',
        cell: ({ row }) => <KeyFigure v={row.original.lpSplitAmount} />,
      },
      {
        accessorKey: 'completedTime',
        header: 'Completed At',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatTime(row.original.completedTime)}
          </span>
        ),
      },
    ],
    [],
  );

  const orderColumns = React.useMemo<
    ColumnDef<SettleOrderRow & { id: string }>[]
  >(
    () => [
      {
        accessorKey: 'orderId',
        header: 'Settlement Order ID',
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.orderId}</span>
        ),
      },
      {
        accessorKey: 'periodType',
        header: 'Period Type',
        // Unknown granularity shows the raw code (source PERIOD_TYPE_MAP ?? raw)
        cell: ({ row }) => (
          <span>{SETTLE_PERIOD_TYPE_LABEL[row.original.periodType] ?? row.original.periodType}</span>
        ),
      },
      {
        accessorKey: 'periodStart',
        header: 'Period Range',
        cell: ({ row }) => (
          <span className="block min-w-[320px] whitespace-nowrap tabular-nums">
            {periodText(row.original)}
          </span>
        ),
      },
      {
        accessorKey: 'txCount',
        header: 'Tx Count',
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {row.original.txCount}
          </span>
        ),
      },
      {
        accessorKey: 'principalTotal',
        header: 'Principal Total',
        cell: ({ row }) => <Money v={row.original.principalTotal} />,
      },
      {
        accessorKey: 'markupTotal',
        header: 'Markup Total',
        cell: ({ row }) => <Money v={row.original.markupTotal} />,
      },
      {
        accessorKey: 'lpSplitTotal',
        header: 'LP Split Total',
        cell: ({ row }) => <KeyFigure v={row.original.lpSplitTotal} />,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <OrderStatusBadge status={row.original.status} />,
      },
      {
        id: 'actions',
        header: 'Operations',
        cell: ({ row }) => (
          <Button
            variant="link"
            size="sm"
            className="h-auto whitespace-nowrap p-0"
            onClick={() => setBreakdownRow(row.original)}
          >
            {LBL.breakdown}
          </Button>
        ),
      },
    ],
    [],
  );

  const recordTableData = React.useMemo(
    // v2.3 行 VO 无独立 ID 字段：只读表以行序作 row key（无重排/删除场景）
    () => recordRows.map((r, i) => ({ ...r, id: String(i) })),
    [recordRows],
  );
  const orderTableData = React.useMemo(
    () => orderRows.map((r) => ({ ...r, id: String(r.orderId) })),
    [orderRows],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {LBL.eyebrow}
          </div>
          <h1 className="text-xl font-semibold">{LBL.title}</h1>
        </div>
        {/* settle_order domain intentionally refreshes orders only */}
        <SyncRefreshButton domain="settle_order" onRefreshed={refreshOrdersTab} />
      </div>

      {down && <ServiceDownAlert traceId={down.traceId} />}

      <div className="rounded-lg border-border/60 bg-card shadow-float">
        <Tabs defaultValue="records" className="w-full">
          <TabsList className="m-4">
            <TabsTrigger value="records">{LBL.tabRecords}</TabsTrigger>
            <TabsTrigger value="orders">{LBL.tabOrders}</TabsTrigger>
          </TabsList>

          {/* ===== Settlement records ===== */}
          <TabsContent value="records" className="mt-0 px-6 pb-6">
            <form
              onSubmit={recordsForm.handleSubmit((f) =>
                setRecordsParams(recordsFormToParams(f, 1)),
              )}
              className="mb-4"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <FormField
                  name="startTime"
                  label="Completed From"
                  type="datetime-local"
                  register={recordsForm.register('startTime')}
                />
                <FormField
                  name="endTime"
                  label="Completed To"
                  type="datetime-local"
                  register={recordsForm.register('endTime')}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="submit">{LBL.query}</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    recordsForm.reset(EMPTY_RECORDS_FILTER);
                    setRecordsParams(recordsFormToParams(EMPTY_RECORDS_FILTER, 1));
                  }}
                >
                  {LBL.reset}
                </Button>
              </div>
            </form>

            {/* Provider 作用域覆盖 txNo tooltip（tooltip 仅存在于流水表） */}
            <TooltipProvider delayDuration={200}>
              <DataTable
                columns={recordColumns}
                data={recordTableData}
                isLoading={recordsQuery.isPending}
                emptyMessage={LBL.empty}
                pagination={{
                  page: recordsParams.pageNum,
                  pageSize: PAGE_SIZE,
                  total: recordsTotal,
                  onPageChange: (page) =>
                    setRecordsParams((prev) => ({ ...prev, pageNum: page })),
                  pageSizeOptions: [PAGE_SIZE],
                }}
              />
            </TooltipProvider>
          </TabsContent>

          {/* ===== Settlement orders ===== */}
          <TabsContent value="orders" className="mt-0 px-6 pb-6">
            <form
              onSubmit={ordersForm.handleSubmit((f) =>
                setOrdersParams(ordersFormToParams(f, 1)),
              )}
              className="mb-4"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <FormSelect
                  name="status"
                  control={ordersForm.control}
                  label="Status"
                  options={ORDER_STATUS_OPTIONS}
                />
                <FormSelect
                  name="cycle"
                  control={ordersForm.control}
                  label="Period"
                  options={[{ value: ALL, label: 'All' }, ...ORDER_CYCLE_OPTIONS]}
                />
                <FormField
                  name="startTime"
                  label="Completed From"
                  type="datetime-local"
                  register={ordersForm.register('startTime')}
                />
                <FormField
                  name="endTime"
                  label="Completed To"
                  type="datetime-local"
                  register={ordersForm.register('endTime')}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="submit">{LBL.query}</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    ordersForm.reset(EMPTY_ORDERS_FILTER);
                    setOrdersParams(ordersFormToParams(EMPTY_ORDERS_FILTER, 1));
                  }}
                >
                  {LBL.reset}
                </Button>
              </div>
            </form>

            <DataTable
              columns={orderColumns}
              data={orderTableData}
              isLoading={ordersQuery.isPending}
              emptyMessage={LBL.empty}
              pagination={{
                page: ordersParams.pageNum,
                pageSize: PAGE_SIZE,
                total: ordersTotal,
                onPageChange: (page) =>
                  setOrdersParams((prev) => ({ ...prev, pageNum: page })),
                pageSizeOptions: [PAGE_SIZE],
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Breakdown dialog reads the row payload directly; no footer buttons */}
      <Dialog
        open={breakdownRow !== null}
        onOpenChange={(o) => !o && setBreakdownRow(null)}
      >
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>{LBL.breakdown}</DialogTitle>
          </DialogHeader>
          {breakdownRow && <ItemsTable items={readOrderItems(breakdownRow)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
