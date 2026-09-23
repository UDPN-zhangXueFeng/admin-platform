'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import {
  Activity,
  ArrowLeft,
  Ban,
  Building2,
  Calendar,
  Coins,
  MoreHorizontal,
  Plus,
  Send,
} from 'lucide-react';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from '@myorg/shared/ui';
import { formatAdminDateTime } from '@myorg/shared/util-dates';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  KISSEN_PROJECT_ID,
  LP_STATUS_LABEL,
  SETTLE_CYCLE_MAP,
  SETTLE_ORDER_STATUS_VALUES,
  SETTLE_PERIOD_TYPE_LABEL,
  useLpSettleCycleListQuery,
  useLpSettleCycleSaveMutation,
  useSettleLpOptionsQuery,
  useSettleOrderConfirmMutation,
  useSettleOrderDetailQuery,
  useSettleOrderItemsQuery,
  useSettleOrderListQuery,
  useSettleOrderVoidMutation,
  useTokenMeta,
  useTransactionListQuery,
  type LpListReq,
  type LpRow,
  type SettleOrderItemRow,
  type SettleOrderRow,
  type TransactionPageFilter,
  type TransactionRow,
} from '@myorg/modules/kissen-admin/data-access';

import { formatAmount } from './format';
import { formatRate, formatUtc8 } from './proto-format';
import {
  ActionConfirmDialog,
  CopyableId,
  Dash,
  ProtoStatusBadge,
  type ProtoStatusTone,
} from './proto-ui';
import {
  PROTO_SETTLE_ORDER_STATUS,
  PROTO_TX_STATUS,
  protoStatusLabel,
  protoStatusRank,
} from './proto-enums';
import { ProtoSortHeader, useProtoSort } from './proto-sort';

/* ============================================================ */
/* 共享格式化 / 展示辅助                                          */
/* ============================================================ */

const PAGE_SIZE_DEFAULT = 10;

/** 「全部」哨兵值：Select 中代表不限定的选项（Radix Select 禁空串 value）。 */
const ALL = 'all';

function toNumberOrUndef(v: string | undefined): number | undefined {
  if (!v || v === ALL) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** 周期类型文案（1 日 / 2 周 / 3 月，未匹配显原值）。 */
function periodTypeLabel(periodType: number): string {
  return SETTLE_PERIOD_TYPE_LABEL[periodType] ?? String(periodType);
}

/** 详情字段（label 小字灰 + 值一行；空值统一 Dash）。 */
function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

/** 详情卡分区头（图标方帖 + 标题；右可挂 aside，如计数）。 */
function DetailSectionHeader({
  icon: Icon,
  title,
  aside,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  aside?: React.ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {aside}
    </header>
  );
}

function LoadingBlock() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

/* ============================================================ */
/* settle-order — 结算单列表（原型 SettlementStatementsPage）      */
/* ============================================================ */

/** 结算单状态 → 原型语义色（10 待确认 warning / 20 已确认 info / 35 已结算 success / 45 作废 muted）。 */
const ORDER_STATUS_TONE: Record<number, ProtoStatusTone> = {
  10: 'warning',
  20: 'info',
  35: 'success',
  45: 'muted',
};

const SETTLE_LIST_PATH = '/settle/order';

interface SettleOrderParams {
  pageNum: number;
  pageSize: number;
  lpId?: number;
  periodType?: number;
  status?: number;
}

export function SettleOrderListPage() {
  const router = useRouter();
  const toast = useToast();
  const [lpInput, setLpInput] = React.useState(ALL);
  const [cycleInput, setCycleInput] = React.useState(ALL);
  const [statusInput, setStatusInput] = React.useState(ALL);
  const [params, setParams] = React.useState<SettleOrderParams>({
    pageNum: 1,
    pageSize: PAGE_SIZE_DEFAULT,
  });

  const { data, isLoading, isError, dataUpdatedAt } = useSettleOrderListQuery(
    KISSEN_PROJECT_ID,
    {
      pageNum: params.pageNum,
      pageSize: params.pageSize,
      filter: {
        lpId: params.lpId,
        periodType: params.periodType,
        status: params.status,
      },
    },
  );
  const { data: lpOptions } = useSettleLpOptionsQuery(KISSEN_PROJECT_ID);
  const confirmMutation = useSettleOrderConfirmMutation(KISSEN_PROJECT_ID);
  const voidMutation = useSettleOrderVoidMutation(KISSEN_PROJECT_ID);

  /** 动作弹窗目标（仅 Pending Confirmation 行可提交/作废）。 */
  const [submitTarget, setSubmitTarget] = React.useState<SettleOrderRow | null>(null);
  const [voidTarget, setVoidTarget] = React.useState<SettleOrderRow | null>(null);

  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;

  // 服务端分页 + 排序端点缺位：排序仅作用于当前页（口径同 approval/system 页）。
  const { sorted, toggle, sortState } = useProtoSort(
    rows,
    {
      statementId: { value: (r) => r.orderId },
      lpName: { value: (r) => r.lpName },
      settlementCycle: { value: (r) => r.periodType },
      periodRange: { value: (r) => r.periodStart },
      transactions: { value: (r) => r.txCount },
      status: { value: (r) => protoStatusRank(PROTO_SETTLE_ORDER_STATUS, r.status) },
      createdOn: { value: (r) => r.createTime },
    },
    'createdOn',
    'desc',
  );

  const tableData = React.useMemo(
    () => sorted.map((r) => ({ ...r, id: String(r.orderId) })),
    [sorted],
  );

  /** 搜索提交：回第 1 页并应用当前筛选。 */
  const onSearch = React.useCallback(() => {
    setParams((prev) => ({
      ...prev,
      pageNum: 1,
      lpId: toNumberOrUndef(lpInput),
      periodType: toNumberOrUndef(cycleInput),
      status: toNumberOrUndef(statusInput),
    }));
  }, [lpInput, cycleInput, statusInput]);

  const onReset = React.useCallback(() => {
    setLpInput(ALL);
    setCycleInput(ALL);
    setStatusInput(ALL);
    setParams({ pageNum: 1, pageSize: PAGE_SIZE_DEFAULT });
  }, []);

  /**
   * 生成入口（原型 Generate Settlement Statement 按钮）。
   */
  const onGenerate = React.useCallback(() => {
    // STATIC-FILLER(GAP-ADM-09): 后端无手动生成结算单端点——KISSEN_SETTLEMENT_ORDER_GEN
    // 按结算周期任务自动生成；保留原型按钮位，点击仅提示，待端点补齐后接确认弹窗。
    toast.info(
      'Settlement statements are generated automatically by the scheduled job at each cycle end; manual generation is not available yet.',
    );
  }, [toast]);

  const columns = React.useMemo<ColumnDef<SettleOrderRow & { id: string }>[]>(
    () => [
      {
        id: 'statementId',
        header: () => (
          <ProtoSortHeader
            label="Statement ID"
            columnKey="statementId"
            toggle={toggle}
            sortState={sortState('statementId')}
          />
        ),
        cell: ({ row }) => <CopyableId value={String(row.original.orderId)} />,
      },
      {
        id: 'lpName',
        header: () => (
          <ProtoSortHeader
            label="LP Name"
            columnKey="lpName"
            toggle={toggle}
            sortState={sortState('lpName')}
          />
        ),
        cell: ({ row }) => (
          <span className="font-semibold">{row.original.lpName || <Dash />}</span>
        ),
      },
      {
        id: 'settlementCycle',
        header: () => (
          <ProtoSortHeader
            label="Settlement Cycle"
            columnKey="settlementCycle"
            toggle={toggle}
            sortState={sortState('settlementCycle')}
          />
        ),
        cell: ({ row }) => (
          <Badge variant="outline">{periodTypeLabel(row.original.periodType)}</Badge>
        ),
      },
      {
        id: 'periodRange',
        header: () => (
          <ProtoSortHeader
            label="Period Range (UTC+8)"
            columnKey="periodRange"
            toggle={toggle}
            sortState={sortState('periodRange')}
          />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatUtc8(row.original.periodStart)} ~ {formatUtc8(row.original.periodEnd)}
          </span>
        ),
      },
      {
        id: 'transactions',
        header: () => (
          <div className="flex justify-end">
            <ProtoSortHeader
              label="Transactions"
              columnKey="transactions"
              toggle={toggle}
              sortState={sortState('transactions')}
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums">{row.original.txCount}</div>
        ),
      },
      {
        id: 'status',
        header: () => (
          <ProtoSortHeader
            label="Status"
            columnKey="status"
            toggle={toggle}
            sortState={sortState('status')}
          />
        ),
        cell: ({ row }) => (
          <ProtoStatusBadge tone={ORDER_STATUS_TONE[row.original.status] ?? 'muted'}>
            {protoStatusLabel(PROTO_SETTLE_ORDER_STATUS, row.original.status)}
          </ProtoStatusBadge>
        ),
      },
      {
        id: 'createdOn',
        header: () => (
          <ProtoSortHeader
            label="Created on (UTC+8)"
            columnKey="createdOn"
            toggle={toggle}
            sortState={sortState('createdOn')}
          />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{formatUtc8(row.original.createTime)}</span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const item = row.original;
          // 原型：Details 常显 + ⋮ 菜单（仅 Pending Confirmation：
          // Submit for Approval / Void danger）。
          return (
            <div className="flex items-center">
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() =>
                  router.push(`${SETTLE_LIST_PATH}/detail?id=${item.orderId}`)
                }
              >
                Details
              </Button>
              {item.status === 10 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      aria-label={`Actions for statement ${item.orderId}`}
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setSubmitTarget(item)}>
                      Submit for Approval
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => setVoidTarget(item)}
                    >
                      Void
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          );
        },
      },
    ],
    [toggle, sortState, router],
  );

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              Settlement Statements
            </div>
            {!isLoading && paginationMeta ? (
              <span className="text-sm text-muted-foreground tabular-nums">
                {paginationMeta.total} results
              </span>
            ) : null}
            {dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Updated {formatAdminDateTime(dataUpdatedAt)}
              </span>
            ) : null}
          </div>
          <Button size="sm" onClick={onGenerate}>
            <Plus className="size-4" aria-hidden="true" />
            Generate Settlement Statement
          </Button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSearch();
          }}
          className="border-b border-border/50 px-4 py-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="settle-order-lp-filter"
                className="text-sm font-medium leading-snug text-foreground"
              >
                LP Name
              </label>
              <Select value={lpInput} onValueChange={setLpInput}>
                <SelectTrigger id="settle-order-lp-filter" className="w-full">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  {(lpOptions ?? []).map((lp) => (
                    <SelectItem key={lp.lpId} value={String(lp.lpId)}>
                      {lp.lpName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="settle-order-cycle-filter"
                className="text-sm font-medium leading-snug text-foreground"
              >
                Settlement Cycle
              </label>
              <Select value={cycleInput} onValueChange={setCycleInput}>
                <SelectTrigger id="settle-order-cycle-filter" className="w-full">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  {Object.entries(SETTLE_CYCLE_MAP).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="settle-order-status-filter"
                className="text-sm font-medium leading-snug text-foreground"
              >
                Status
              </label>
              <Select value={statusInput} onValueChange={setStatusInput}>
                <SelectTrigger id="settle-order-status-filter" className="w-full">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  {SETTLE_ORDER_STATUS_VALUES.map((v) => (
                    <SelectItem key={v} value={String(v)}>
                      {protoStatusLabel(PROTO_SETTLE_ORDER_STATUS, v)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit">Search</Button>
              <Button type="button" variant="outline" onClick={onReset}>
                Reset
              </Button>
            </div>
          </div>
        </form>
        <div className="p-4">
          {isError ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Failed to load. Refresh to retry.</AlertTitle>
            </Alert>
          ) : (
            <DataTable
              columns={columns}
              data={tableData}
              isLoading={isLoading}
              emptyMessage="No settlement statements found."
              pagination={
                paginationMeta
                  ? {
                      page: paginationMeta.page,
                      pageSize: paginationMeta.pageSize,
                      total: paginationMeta.total,
                      onPageChange: (page) =>
                        setParams((prev) => ({ ...prev, pageNum: page })),
                      onPageSizeChange: (n) =>
                        setParams((prev) => ({ ...prev, pageNum: 1, pageSize: n })),
                    }
                  : undefined
              }
            />
          )}
        </div>
      </section>

      {/* 提交审批（原型 STATEMENT_ACTION_CONFIG.submit：Send 图标 + 双段正文）。 */}
      <ActionConfirmDialog
        open={submitTarget != null}
        onOpenChange={(open) => {
          if (!open) setSubmitTarget(null);
        }}
        icon={Send}
        variant="confirm"
        title="Submit for Approval"
        body1={`Submit settlement "${submitTarget?.orderId ?? ''}" for approval?`}
        body2="The statement will be routed to the approval queue and cannot be edited while pending review."
        confirmLabel="Submit"
        loading={confirmMutation.isPending}
        onConfirm={() => {
          const target = submitTarget;
          if (!target) return;
          confirmMutation.mutate(
            { orderId: target.orderId },
            {
              onSuccess: () => {
                toast.success(
                  `Settlement statement #${target.orderId} submitted for approval.`,
                );
                setSubmitTarget(null);
              },
              onError: (err) => toast.error((err as Error).message),
            },
          );
        }}
      />

      {/* 作废（原型 STATEMENT_ACTION_CONFIG.void：Ban 图标 + 双段正文）。 */}
      <ActionConfirmDialog
        open={voidTarget != null}
        onOpenChange={(open) => {
          if (!open) setVoidTarget(null);
        }}
        icon={Ban}
        variant="destructive"
        title="Void Settlement Statement"
        body1={`Void settlement statement #${voidTarget?.orderId ?? ''}? The same period can be regenerated once voided.`}
        body2="Late-arriving transactions will be carried forward to the next period as adjustments."
        confirmLabel="Void"
        loading={voidMutation.isPending}
        onConfirm={() => {
          const target = voidTarget;
          if (!target) return;
          voidMutation.mutate(
            { orderId: target.orderId },
            {
              onSuccess: () => {
                toast.success(`Settlement statement #${target.orderId} voided.`);
                setVoidTarget(null);
              },
              onError: (err) => toast.error((err as Error).message),
            },
          );
        }}
      />
    </div>
  );
}

/* ============================================================ */
/* settle-order — 结算单详情（原型 SettlementStatementDetailsPage）*/
/* ============================================================ */

/** 详情 Tab 值（?tab= 写 URL；statement 缺省不占 query）。 */
type SettleDetailTab = 'statement' | 'transactions' | 'operations';

/** 交易状态 → 原型语义色（FxTransactionsPage STATUS_TONES 同款）。 */
const TX_STATUS_TONE: Record<number, ProtoStatusTone> = {
  1: 'muted', // Created
  5: 'info', // Quoted
  10: 'info', // Confirmed
  20: 'warning', // Source Transferring
  25: 'info', // Source Verified
  30: 'warning', // Processing
  35: 'success', // Settled
  40: 'success', // Completed
  50: 'warning', // Reversing
  60: 'muted', // Reversed
  70: 'danger', // Exception
  80: 'muted', // Cancelled
  90: 'danger', // Failed
};

/** 操作留痕列契约（原型 operations Tab 五列）。 */
const SETTLE_OPERATION_COLUMNS: ColumnDef<{ id: string }>[] = [
  { accessorKey: 'timestamp', header: 'Timestamp (UTC+8)' },
  { accessorKey: 'operator', header: 'Operator' },
  { accessorKey: 'module', header: 'Module' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'traceId', header: 'Trace ID' },
];

/** 分项 token 对展示文本（`A → B`，symbol 优先回退 tokenCode）。 */
function itemPairText(item: SettleOrderItemRow): string {
  const source = item.sourceSymbol || item.sourceTokenCode || '-';
  const target = item.targetSymbol || item.targetTokenCode || '-';
  return `${source} → ${target}`;
}

export function SettleOrderDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderIdRaw = Number(searchParams.get('id'));
  const orderId =
    Number.isFinite(orderIdRaw) && orderIdRaw > 0 ? orderIdRaw : undefined;

  // Tab 状态写 URL（原型同款：statement 缺省不占 query，刷新/分享/后退保持）。
  const tabParam = searchParams.get('tab');
  const activeTab: SettleDetailTab =
    tabParam === 'transactions' || tabParam === 'operations'
      ? tabParam
      : 'statement';
  const handleTabChange = (next: string) => {
    const params = new URLSearchParams();
    if (orderId != null) params.set('id', String(orderId));
    if (next !== 'statement') params.set('tab', next);
    router.replace(`${SETTLE_LIST_PATH}/detail?${params.toString()}`, {
      scroll: false,
    });
  };

  const detailQuery = useSettleOrderDetailQuery(KISSEN_PROJECT_ID, orderId);
  const detail = detailQuery.data;
  const itemsQuery = useSettleOrderItemsQuery(
    KISSEN_PROJECT_ID,
    orderId ?? 0,
    orderId != null,
  );
  const items = itemsQuery.data ?? [];

  // LP 附加信息（lpCode/联系人）：lp 域无按 lpId 单查端点，取 200 条列表联查。
  const lpQuery = useLpSettleCycleListQuery(KISSEN_PROJECT_ID, {
    pageNum: 1,
    pageSize: 200,
    filter: {},
  } satisfies LpListReq);
  const lpRow = React.useMemo(
    () =>
      detail
        ? (lpQuery.data?.data ?? []).find((lp) => lp.lpId === detail.lpId)
        : undefined,
    [lpQuery.data, detail],
  );

  // Transactions Tab：按 LP + 周期起止过滤交易（tab 激活才请求）。
  const [txPage, setTxPage] = React.useState(1);
  const [txPageSize, setTxPageSize] = React.useState(PAGE_SIZE_DEFAULT);
  const txFilter = React.useMemo<TransactionPageFilter>(
    () =>
      detail
        ? {
            lpId: detail.lpId,
            createTimeStart: detail.periodStart,
            createTimeEnd: detail.periodEnd,
          }
        : {},
    [detail],
  );
  const txQuery = useTransactionListQuery(
    KISSEN_PROJECT_ID,
    { pageNum: txPage, pageSize: txPageSize, filter: txFilter },
    activeTab === 'transactions' && detail != null,
  );
  const txRows = txQuery.data?.data ?? [];
  const txPaginationMeta = txQuery.data?.pagination;

  const { decimalsOf: decOf } = useTokenMeta(KISSEN_PROJECT_ID);

  // Amounts 表默认 pair 升序（原型同款客户端排序）。
  const { sorted: sortedItems, toggle: itemsToggle, sortState: itemsSortState } =
    useProtoSort(
      items,
      {
        tokenPair: { value: (item) => itemPairText(item) },
        txnCount: { value: (item) => item.txCount },
      },
      'tokenPair',
      'asc',
    );
  const itemsTableData = React.useMemo(
    () => sortedItems.map((item) => ({ ...item, id: String(item.itemId) })),
    [sortedItems],
  );

  const amountColumns = React.useMemo<
    ColumnDef<SettleOrderItemRow & { id: string }>[]
  >(
    () => [
      {
        id: 'tokenPair',
        header: () => (
          <ProtoSortHeader
            label="Token Pair"
            columnKey="tokenPair"
            toggle={itemsToggle}
            sortState={itemsSortState('tokenPair')}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{itemPairText(row.original)}</span>
        ),
      },
      {
        id: 'txnCount',
        header: () => (
          <div className="flex justify-end">
            <ProtoSortHeader
              label="Txn Count"
              columnKey="txnCount"
              toggle={itemsToggle}
              sortState={itemsSortState('txnCount')}
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums">{row.original.txCount}</div>
        ),
      },
      {
        id: 'principalTotal',
        header: () => <div className="flex justify-end">Principal Total</div>,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {formatAmount(
              row.original.principalTotal,
              decOf(row.original.sourceTokenCode),
            )}
          </div>
        ),
      },
      {
        id: 'marginTotal',
        header: () => <div className="flex justify-end">Margin Total</div>,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {formatAmount(
              row.original.markupTotal,
              decOf(row.original.sourceTokenCode),
            )}
          </div>
        ),
      },
      {
        id: 'settlementAmount',
        header: () => <div className="flex justify-end">Settlement Amount</div>,
        cell: ({ row }) => (
          <div className="text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatAmount(
              row.original.lpSplitTotal,
              decOf(row.original.sourceTokenCode),
            )}
          </div>
        ),
      },
    ],
    [itemsToggle, itemsSortState, decOf],
  );

  const txColumns = React.useMemo<ColumnDef<TransactionRow & { id: string }>[]>(
    () => [
      {
        id: 'txNo',
        header: 'Transaction No.',
        cell: ({ row }) => <CopyableId value={row.original.txNo} />,
      },
      {
        id: 'tokens',
        header: 'Tokens',
        cell: ({ row }) => {
          const tx = row.original;
          const source = tx.sourceCurrency || '-';
          const target = tx.targetCurrency || '-';
          return (
            <div className="space-y-0.5">
              <span className="font-semibold">
                {source} → {target}
              </span>
              <div className="text-xs text-muted-foreground">
                {tx.sourceBankName || '-'} → {tx.targetBankName || '-'}
              </div>
            </div>
          );
        },
      },
      {
        id: 'from',
        header: 'From',
        cell: ({ row }) => {
          const tx = row.original;
          return (
            <div className="space-y-0.5">
              <span className="font-semibold tabular-nums">
                {formatAmount(tx.principal, decOf(tx.sourceCurrency))}{' '}
                {tx.sourceCurrency || ''}
              </span>
              <CopyableId value={tx.senderAccount} />
            </div>
          );
        },
      },
      {
        id: 'to',
        header: 'To',
        cell: ({ row }) => {
          const tx = row.original;
          return (
            <div className="space-y-0.5">
              <span className="font-semibold tabular-nums">
                {formatAmount(tx.receiverAmount, decOf(tx.targetCurrency))}{' '}
                {tx.targetCurrency || ''}
              </span>
              <CopyableId value={tx.receiverAccount} />
            </div>
          );
        },
      },
      {
        id: 'fxRate',
        header: () => <div className="flex justify-end">FX Rate</div>,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {formatRate(row.original.userRate)}
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <ProtoStatusBadge tone={TX_STATUS_TONE[row.original.status] ?? 'muted'}>
            {protoStatusLabel(PROTO_TX_STATUS, row.original.status)}
          </ProtoStatusBadge>
        ),
      },
      {
        id: 'createdOn',
        header: 'Created on (UTC+8)',
        cell: ({ row }) => (
          <span className="tabular-nums">{formatUtc8(row.original.createTime)}</span>
        ),
      },
    ],
    [decOf],
  );

  const txTableData = React.useMemo(
    () => txRows.map((tx) => ({ ...tx, id: String(tx.transactionId) })),
    [txRows],
  );

  const tabCount = (tab: SettleDetailTab) => {
    if (tab === 'transactions') return detail?.txCount ?? 0;
    return 0; // operations：GAP-ADM-02 静态空表，恒 0。
  };

  const notFound = !detailQuery.isLoading && !detailQuery.isError && !detail;

  return (
    <div className="space-y-4">
      {/* 单层页头（原型 §3.15）：Back + 标题 + 状态徽章 + 元信息行。 */}
      <div className="flex flex-wrap items-start gap-3">
        <Button
          variant="outline"
          size="iconSm"
          aria-label="Back to settlement statements"
          onClick={() => router.push(SETTLE_LIST_PATH)}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold">Settlement Statement Details</h1>
            {detail ? (
              <ProtoStatusBadge tone={ORDER_STATUS_TONE[detail.status] ?? 'muted'}>
                {protoStatusLabel(PROTO_SETTLE_ORDER_STATUS, detail.status)}
              </ProtoStatusBadge>
            ) : null}
          </div>
          {detail ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span>
                Statement:{' '}
                <span className="font-semibold text-foreground">
                  #{detail.orderId}
                </span>
              </span>
              <span aria-hidden="true">|</span>
              <span className="tabular-nums">
                Created on {formatUtc8(detail.createTime)}
              </span>
            </p>
          ) : null}
        </div>
      </div>

      {detailQuery.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Failed to load settlement statement.</AlertTitle>
        </Alert>
      ) : null}

      {notFound ? (
        <div className="rounded-lg border border-border/60 bg-card p-8 text-center">
          <p className="text-sm font-medium text-foreground">
            Settlement statement not found
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            The record may have been removed. Go back to the list.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => router.push(SETTLE_LIST_PATH)}
          >
            Back to settlement statements
          </Button>
        </div>
      ) : null}

      {detail ? (
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="space-y-4"
        >
          {/* 页签条独立于 Card（原型门禁），带计数（statement 非集合无计数）。 */}
          <TabsList>
            <TabsTrigger value="statement">Statement</TabsTrigger>
            {(['transactions', 'operations'] as const).map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {tab === 'transactions' ? 'Transactions' : 'Operations'}
                {tabCount(tab) > 0 ? (
                  <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                    {tabCount(tab)}
                  </span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Tab 1：statement —— LP 信息 + 周期信息 + 金额分项表。 */}
          <TabsContent value="statement" className="mt-0">
            <div className="space-y-4">
              <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <DetailSectionHeader icon={Building2} title="Liquidity Provider" />
                <div className="grid grid-cols-1 gap-x-6 gap-y-5 p-6 md:grid-cols-2 xl:grid-cols-3">
                  <DetailField label="LP Name">
                    {detail.lpName || <Dash />}
                  </DetailField>
                  <DetailField label="LP Code">
                    {lpRow?.lpCode ? (
                      <span className="font-mono">{lpRow.lpCode}</span>
                    ) : (
                      <Dash />
                    )}
                  </DetailField>
                  <DetailField label="Contact">
                    {lpRow?.contactName || <Dash />}
                  </DetailField>
                </div>
                <DetailSectionHeader icon={Calendar} title="Settlement Cycle" />
                <div className="grid grid-cols-1 gap-x-6 gap-y-5 p-6 md:grid-cols-2 xl:grid-cols-3">
                  <DetailField label="Period Type">
                    <Badge variant="outline">
                      {periodTypeLabel(detail.periodType)}
                    </Badge>
                  </DetailField>
                  <DetailField label="Period Range">
                    <span className="tabular-nums">
                      {formatUtc8(detail.periodStart)} ~ {formatUtc8(detail.periodEnd)}
                    </span>
                  </DetailField>
                  <DetailField label="Transactions">
                    <span className="flex items-center gap-1.5">
                      <Activity
                        className="size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      {detail.txCount} transactions
                    </span>
                  </DetailField>
                </div>
              </section>

              <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <DetailSectionHeader
                  icon={Coins}
                  title="Amounts"
                  aside={
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {items.length} token pairs
                    </span>
                  }
                />
                <div className="p-4">
                  {itemsQuery.isLoading ? (
                    <div className="p-2">
                      <LoadingBlock />
                    </div>
                  ) : (
                    <DataTable
                      columns={amountColumns}
                      data={itemsTableData}
                      emptyMessage="No token pairs in this period."
                    />
                  )}
                  <p className="mt-3 px-2 text-xs text-muted-foreground">
                    Amounts are shown per token pair in the settlement currency
                    unit and are not summed across pairs.
                  </p>
                </div>
              </section>
            </div>
          </TabsContent>

          {/* Tab 2：transactions —— 该 LP 周期内交易（按 lpId + 周期起止过滤）。 */}
          <TabsContent value="transactions" className="mt-0">
            <section className="rounded-xl border border-border bg-card shadow-sm">
              <div className="p-4">
                <DataTable
                  columns={txColumns}
                  data={txTableData}
                  isLoading={txQuery.isLoading}
                  emptyMessage="No transactions for this liquidity provider."
                  pagination={
                    txPaginationMeta
                      ? {
                          page: txPaginationMeta.page,
                          pageSize: txPaginationMeta.pageSize,
                          total: txPaginationMeta.total,
                          onPageChange: setTxPage,
                          onPageSizeChange: (n) => {
                            setTxPage(1);
                            setTxPageSize(n);
                          },
                        }
                      : undefined
                  }
                />
              </div>
            </section>
          </TabsContent>

          {/* Tab 3：operations —— 静态空表（GAP-ADM-02）。 */}
          <TabsContent value="operations" className="mt-0">
            <section className="rounded-xl border border-border bg-card shadow-sm">
              {/* STATIC-FILLER(GAP-ADM-02): operate-log 无按对象（orderId）过滤 API，
                  静态空表 + 列契约（Timestamp/Operator/Module/Status/Trace ID）。 */}
              <DataTable
                columns={SETTLE_OPERATION_COLUMNS}
                data={[] as { id: string }[]}
                emptyMessage="No operations recorded yet."
              />
            </section>
          </TabsContent>
        </Tabs>
      ) : detailQuery.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : null}
    </div>
  );
}

/* ============================================================ */
/* settle-cycle — 结算周期配置（原型 SettlementCycleSetupPage）    */
/* ============================================================ */

interface CycleParams {
  pageNum: number;
  pageSize: number;
  lpName?: string;
  settleCycle?: number;
  /** 原型 'Inactive / Rejected' 桶：后端仅 approved(20)/非 20 二值，在审态亦落入此桶。 */
  notApproved?: boolean;
  status?: number;
}

/** Status 筛选值（ALL / '20' Approved / 'not20' Inactive / Rejected）。 */
const CYCLE_STATUS_APPROVED = '20';
const CYCLE_STATUS_NOT_APPROVED = 'not20';

export function SettleCycleListPage() {
  const toast = useToast();
  const [lpNameInput, setLpNameInput] = React.useState(ALL);
  const [settleCycleInput, setSettleCycleInput] = React.useState(ALL);
  const [statusInput, setStatusInput] = React.useState(ALL);
  const [params, setParams] = React.useState<CycleParams>({
    pageNum: 1,
    pageSize: PAGE_SIZE_DEFAULT,
  });
  /** 行内草稿（lpId → settleCycle）；未变更行 Save 禁用，Save 成功/失败均清草稿。 */
  const [cycleDrafts, setCycleDrafts] = React.useState<Record<number, number>>({});

  const queryParams = React.useMemo<LpListReq>(
    () => ({
      pageNum: params.pageNum,
      pageSize: params.pageSize,
      filter: {
        lpName: params.lpName,
        settleCycle: params.settleCycle,
        status: params.status,
        notApproved: params.notApproved,
      },
    }),
    [params],
  );
  const optionsQueryParams = React.useMemo<LpListReq>(
    () => ({
      pageNum: 1,
      pageSize: 200,
      filter: {},
    }),
    [],
  );

  const { data, isLoading, isError, dataUpdatedAt } = useLpSettleCycleListQuery(KISSEN_PROJECT_ID, queryParams);
  const { data: optionsData } = useLpSettleCycleListQuery(
    KISSEN_PROJECT_ID,
    optionsQueryParams,
  );
  const saveMutation = useLpSettleCycleSaveMutation(KISSEN_PROJECT_ID);

  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;
  const optionRows = optionsData?.data ?? rows;
  const lpNameOptions = React.useMemo(() => {
    const names = new Set(
      optionRows
        .map((row) => row.lpName?.trim())
        .filter((name): name is string => Boolean(name)),
    );
    return [...names].sort((nameA, nameB) => nameA.localeCompare(nameB));
  }, [optionRows]);

  /** 搜索提交：回第 1 页，并提交当前下拉筛选值。 */
  const onSearch = React.useCallback(() => {
    setParams((prev) => ({
      ...prev,
      pageNum: 1,
      lpName: lpNameInput === ALL ? undefined : lpNameInput,
      settleCycle: toNumberOrUndef(settleCycleInput),
      status: statusInput === CYCLE_STATUS_APPROVED ? 20 : undefined,
      notApproved: statusInput === CYCLE_STATUS_NOT_APPROVED ? true : undefined,
    }));
  }, [lpNameInput, settleCycleInput, statusInput]);

  /** 重置搜索条件（原型默认 All）。 */
  const onReset = React.useCallback(() => {
    setLpNameInput(ALL);
    setSettleCycleInput(ALL);
    setStatusInput(ALL);
    setParams((prev) => ({ ...prev, pageNum: 1 }));
  }, []);

  /**
   * 保存单行草稿（原型 Save 按钮）：成功 toast 逐字文案并清草稿；
   * 失败清草稿回显库内值 + toast error。
   */
  const onSaveCycle = React.useCallback(
    (row: LpRow, cycle: number) => {
      // STATIC-FILLER(GAP-ADM-06): 后端无批量保存端点，原型逐行 Save 语义按逐条提交实现。
      saveMutation.mutate(
        { lpId: row.lpId, settleCycle: cycle },
        {
          onSuccess: () => {
            toast.success(
              `Settlement cycle for "${row.lpName}" saved as ${SETTLE_CYCLE_MAP[cycle] ?? 'Monthly'}.`,
            );
            setCycleDrafts((prev) => {
              const next = { ...prev };
              delete next[row.lpId];
              return next;
            });
          },
          onError: (err) => {
            toast.error((err as Error).message);
            setCycleDrafts((prev) => {
              const next = { ...prev };
              delete next[row.lpId];
              return next;
            });
          },
        },
      );
    },
    [saveMutation, toast],
  );

  const columns = React.useMemo<ColumnDef<LpRow & { id: string }>[]>(
    () => [
      {
        accessorKey: 'lpName',
        header: 'LP Name',
      },
      {
        accessorKey: 'lpCode',
        header: 'LP Code',
      },
      {
        id: 'contactName',
        header: 'Contact',
        cell: ({ row }) =>
          row.original.contactName ? (
            <span>{row.original.contactName}</span>
          ) : (
            <Dash />
          ),
      },
      {
        id: 'settleCycle',
        header: 'Settlement Cycle',
        cell: ({ row }) => {
          const lp = row.original;
          const draft = cycleDrafts[lp.lpId];
          return (
            <Select
              value={String(draft ?? lp.settleCycle ?? 3)}
              onValueChange={(v) =>
                setCycleDrafts((prev) => ({ ...prev, [lp.lpId]: Number(v) }))
              }
            >
              <SelectTrigger
                className="h-8 w-[190px]"
                aria-label={`Settlement cycle of ${lp.lpName}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SETTLE_CYCLE_MAP).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const status = row.original.status;
          if (status === 20) {
            return <ProtoStatusBadge tone="success">Approved</ProtoStatusBadge>;
          }
          if (status === 15 || status === 50) {
            return (
              <ProtoStatusBadge tone="muted">Inactive / Rejected</ProtoStatusBadge>
            );
          }
          // 后端筛选仅 approved/非 20 二值：在审态（1/5/10）回退域文案展示。
          return (
            <ProtoStatusBadge tone="info">
              {LP_STATUS_LABEL[status] ?? status}
            </ProtoStatusBadge>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const lp = row.original;
          const draft = cycleDrafts[lp.lpId];
          const unchanged = draft === undefined || draft === (lp.settleCycle ?? 3);
          return (
            <Button
              variant="outline"
              size="sm"
              disabled={unchanged || saveMutation.isPending}
              onClick={() => draft !== undefined && onSaveCycle(lp, draft)}
            >
              Save
            </Button>
          );
        },
      },
    ],
    [cycleDrafts, saveMutation.isPending, onSaveCycle],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.lpId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      {/* 页头 hint（原型 el-alert info 逐字）。 */}
      <Alert>
        <AlertDescription>
          Configure the settlement statement generation cycle per LP
          (daily/weekly/monthly, monthly by default); changes take effect from
          the next settlement statement.
        </AlertDescription>
      </Alert>

      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              Cycle Settings
            </div>
            {!isLoading && paginationMeta ? (
              <span className="text-sm text-muted-foreground tabular-nums">
                {paginationMeta.total} results
              </span>
            ) : null}
            {dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Updated {formatAdminDateTime(dataUpdatedAt)}
              </span>
            ) : null}
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSearch();
          }}
          className="border-b border-border/50 px-4 py-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="settle-cycle-lp-name"
                className="text-sm font-medium leading-snug text-foreground"
              >
                LP Name
              </label>
              <Select value={lpNameInput} onValueChange={setLpNameInput}>
                <SelectTrigger id="settle-cycle-lp-name" className="w-full">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  {lpNameOptions.map((lpName) => (
                    <SelectItem key={lpName} value={lpName}>
                      {lpName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="settle-cycle-filter"
                className="text-sm font-medium leading-snug text-foreground"
              >
                Settlement Cycle
              </label>
              <Select value={settleCycleInput} onValueChange={setSettleCycleInput}>
                <SelectTrigger id="settle-cycle-filter" className="w-full">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  {Object.entries(SETTLE_CYCLE_MAP).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="settle-cycle-status-filter"
                className="text-sm font-medium leading-snug text-foreground"
              >
                Status
              </label>
              <Select value={statusInput} onValueChange={setStatusInput}>
                <SelectTrigger id="settle-cycle-status-filter" className="w-full">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  <SelectItem value={CYCLE_STATUS_APPROVED}>Approved</SelectItem>
                  <SelectItem value={CYCLE_STATUS_NOT_APPROVED}>
                    Inactive / Rejected
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit">Search</Button>
              <Button type="button" variant="outline" onClick={onReset}>
                Reset
              </Button>
            </div>
          </div>
        </form>
        <div className="p-4">
          {isError ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Failed to load. Refresh to retry.</AlertTitle>
            </Alert>
          ) : (
            <DataTable
              columns={columns}
              data={tableData}
              isLoading={isLoading}
              emptyMessage="No settlement cycle settings found."
              pagination={
                paginationMeta
                  ? {
                      page: paginationMeta.page,
                      pageSize: paginationMeta.pageSize,
                      total: paginationMeta.total,
                      onPageChange: (page) =>
                        setParams((prev) => ({ ...prev, pageNum: page })),
                      onPageSizeChange: (n) =>
                        setParams((prev) => ({ ...prev, pageNum: 1, pageSize: n })),
                    }
                  : undefined
              }
            />
          )}
        </div>
      </section>
    </div>
  );
}
