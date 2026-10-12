'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft } from 'lucide-react';

import { useSearchParams } from 'next/navigation';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  useToast,
} from '@myorg/shared/ui';

import { formatAdminDateTime } from '@myorg/shared/util-dates';
import { FormSelect } from '@myorg/shared/ui-forms';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  KISSEN_PROJECT_ID,
  LP_STATUS_LABEL,
  type LpListReq,
  SETTLE_CYCLE_MAP,
  SETTLE_ORDER_STATUS_LABEL,
  SETTLE_ORDER_STATUS_VALUES,
  SETTLE_PERIOD_TYPE_LABEL,
  useLpSettleCycleListQuery,
  useLpSettleCycleSaveMutation,
  useSettleItemRecordsQuery,
  useSettleLpOptionsQuery,
  useSettleOrderConfirmMutation,
  useSettleOrderDetailQuery,
  useSettleOrderItemsQuery,
  useSettleOrderListQuery,
  useSettleOrderVoidMutation,
  useTokenMeta,
  type LpRow,
  type SettleItemRecordRow,
  type SettleOrderItemRow,
  type SettleOrderRow,
} from '@myorg/modules/kissen-admin/data-access';

import { formatAmount } from './format';
import { Dash, ProtoStatusBadge } from './proto-ui';

/* ============================================================ */
/* 共享格式化 / 展示辅助                                          */
/* ============================================================ */

const PAGE_SIZE_DEFAULT = 10;

/** 毫秒时间戳 → `Sep 2, 2026, 09:09:10 (UTC+8)`；0/空 → '--'。 */
function formatTimestamp(ms: number | undefined | null): string {
  if (!ms) return '--';
  const d = new Date(Number(ms));
  return Number.isNaN(d.getTime()) ? '--' : formatAdminDateTime(d);
}

/** 「全部」哨兵值：FormSelect 中代表不限定的选项（Radix Select 禁空串 value）。 */
const ALL = 'all';

function optAll() {
  return { value: ALL, label: 'All' };
}

function toNumberOrUndef(v: string | undefined): number | undefined {
  if (!v || v === ALL) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** 周期类型文案（1 日 / 2 周 / 3 月，未匹配显原值）。 */
function periodTypeLabel(periodType: number): string {
  return SETTLE_PERIOD_TYPE_LABEL[periodType] ?? String(periodType);
}

/* ============================================================ */
/* 共享小组件                                                    */
/* ============================================================ */

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-muted-foreground">
        {label}
      </label>
      <div className="text-sm tabular-nums">{children}</div>
    </div>
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

/** 组表单元格基线（样式对齐 shared DataTable：表头 bg-muted/50、行 divide-y）。 */
const GROUP_TH =
  'h-10 px-4 text-left align-middle font-medium text-muted-foreground';
const GROUP_TD = 'px-4 py-3 align-middle';

/* ============================================================ */
/* settle-order — 结算单                                          */
/* ============================================================ */

interface SettleOrderFilterForm {
  lpId: string;
  periodType: string;
  status: string;
}

const EMPTY_SETTLE_FILTER: SettleOrderFilterForm = {
  lpId: ALL,
  periodType: ALL,
  status: ALL,
};

function settleFilterToParams(
  form: SettleOrderFilterForm,
  pageNum: number,
  pageSize: number,
) {
  return {
    pageNum,
    pageSize,
    filter: {
      lpId: toNumberOrUndef(form.lpId),
      periodType: toNumberOrUndef(form.periodType),
      status: toNumberOrUndef(form.status),
    },
  };
}

const ORDER_STATUS_TONE: Record<
  number,
  'warning' | 'info' | 'success' | 'muted'
> = {
  10: 'warning',
  20: 'info',
  35: 'success',
  45: 'muted',
};

function SettleOrderNotFound() {
  const router = useRouter();

  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
      <p className="text-sm text-muted-foreground">
        Settlement statement not found
      </p>
      <Button
        className="mt-4"
        variant="outline"
        onClick={() => router.push('/settle/order')}
      >
        Back to settlement statements
      </Button>
    </div>
  );
}

/** Independent, refreshable settlement statement route: /settle/order/detail?id=. */
export function SettleOrderDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawId = searchParams.get('id');
  const parsedId = Number(rawId);
  const hasValidId =
    rawId !== null &&
    rawId !== '' &&
    Number.isSafeInteger(parsedId) &&
    parsedId > 0;
  const detailQuery = useSettleOrderDetailQuery(
    KISSEN_PROJECT_ID,
    hasValidId ? parsedId : undefined,
  );
  const detail = detailQuery.data;
  const isLoading = hasValidId && detailQuery.isLoading && !detail;
  const isNotFound =
    !hasValidId ||
    (!isLoading && !detailQuery.isError && !detail);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Button
          variant="outline"
          size="iconSm"
          aria-label="Back to settlement statements"
          onClick={() => router.push('/settle/order')}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">
            Settlement Statement Details
          </h1>
          {detail ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span>
                Statement ID:{' '}
                <span className="font-semibold text-foreground">
                  {detail.orderId}
                </span>
              </span>
              <span aria-hidden="true">|</span>
              <span className="tabular-nums">
                Created on {formatTimestamp(detail.createTime)}
              </span>
              <ProtoStatusBadge
                tone={ORDER_STATUS_TONE[detail.status] ?? 'muted'}
              >
                {SETTLE_ORDER_STATUS_LABEL[detail.status] ?? detail.status}
              </ProtoStatusBadge>
            </p>
          ) : null}
        </div>
      </div>

      {detailQuery.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Failed to load settlement statement.</AlertTitle>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : null}

      {isNotFound ? <SettleOrderNotFound /> : null}

      {detail && !detailQuery.isError ? (
        <SettleOrderDetailContent key={detail.orderId} order={detail} />
      ) : null}
    </div>
  );
}

function SettleOrderDetailContent({ order }: { order: SettleOrderRow }) {
  const router = useRouter();
  const [itemRecordsTarget, setItemRecordsTarget] =
    React.useState<SettleItemRecordsTarget | null>(null);

  const onItemRecords = React.useCallback(
    (item: SettleOrderItemRow) => {
      setItemRecordsTarget({
        orderId: order.orderId,
        pairId: item.pairId,
        pairText: `${item.sourceSymbol || item.sourceTokenCode || '-'}/${item.targetSymbol || item.targetTokenCode || '-'}`,
        sourceTokenCode: item.sourceTokenCode || '',
      });
    },
    [order.orderId],
  );

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border/50 px-6 py-4">
          <h2 className="text-base font-semibold">Statement Information</h2>
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 px-6 py-5 sm:grid-cols-2 lg:grid-cols-3">
          <DetailField label="Statement ID">{order.orderId}</DetailField>
          <DetailField label="LP Name">{order.lpName || '--'}</DetailField>
          <DetailField label="Period Type">
            {periodTypeLabel(order.periodType)}
          </DetailField>
          <DetailField label="Period Range">
            <span className="block tabular-nums">
              {formatTimestamp(order.periodStart)} –{' '}
              {formatTimestamp(order.periodEnd)}
            </span>
          </DetailField>
          <DetailField label="Transactions">
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-left"
              disabled={order.txCount === 0}
              onClick={() =>
                router.push(
                  `/transfer/tx?lpId=${order.lpId}&createTimeStart=${order.periodStart}&createTimeEnd=${order.periodEnd}`,
                )
              }
            >
              View {order.txCount} transactions →
            </Button>
          </DetailField>
          <DetailField label="Created on">
            {formatTimestamp(order.createTime)}
          </DetailField>
        </div>
      </section>

      <SettleOrderItemsPanel order={order} onItemRecords={onItemRecords} />
      <SettleItemRecordsDialog
        target={itemRecordsTarget}
        onClose={() => setItemRecordsTarget(null)}
      />
    </div>
  );
}

/* 结算单分项只在独立详情页加载，金额按各自源 Token 精度展示。 */
function SettleOrderItemsPanel({
  order,
  onItemRecords,
}: {
  order: SettleOrderRow;
  onItemRecords: (item: SettleOrderItemRow) => void;
}) {
  const { data, isLoading, isError } = useSettleOrderItemsQuery(
    KISSEN_PROJECT_ID,
    order.orderId,
  );
  const items = data ?? [];
  const { decimalsOf } = useTokenMeta(KISSEN_PROJECT_ID);
  const tableData = items.map((item) => ({ ...item, id: String(item.itemId) }));
  const columns = React.useMemo<ColumnDef<(typeof tableData)[number]>[]>(
    () => [
      {
        id: 'tokenPair',
        header: 'Token Pair',
        cell: ({ row }) => {
          const item = row.original;
          return `${item.sourceSymbol || item.sourceTokenCode || '-'}/${item.targetSymbol || item.targetTokenCode || '-'}`;
        },
      },
      {
        accessorKey: 'txCount',
        header: () => <span className="block text-right">Txn Count</span>,
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {row.original.txCount}
          </span>
        ),
      },
      {
        id: 'principalTotal',
        header: () => <span className="block text-right">Principal Total</span>,
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {formatAmount(
              row.original.principalTotal,
              decimalsOf(row.original.sourceTokenCode),
            )}
          </span>
        ),
      },
      {
        id: 'markupTotal',
        header: () => <span className="block text-right">Markup Total</span>,
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {formatAmount(
              row.original.markupTotal,
              decimalsOf(row.original.sourceTokenCode),
            )}
          </span>
        ),
      },
      {
        id: 'lpSplitTotal',
        header: () => <span className="block text-right">LP Share</span>,
        cell: ({ row }) => (
          <span className="block text-right font-semibold text-success tabular-nums">
            {formatAmount(
              row.original.lpSplitTotal,
              decimalsOf(row.original.sourceTokenCode),
            )}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const item = row.original;
          const hasValidPairId =
            Number.isSafeInteger(item.pairId) && item.pairId > 0;
          return (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              disabled={!hasValidPairId}
              onClick={() => onItemRecords(item)}
            >
              Settlement details
            </Button>
          );
        },
      },
    ],
    [decimalsOf, onItemRecords],
  );

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border/50 px-6 py-4">
        <h2 className="text-base font-semibold">Amounts</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Amounts are in each token pair&apos;s own currency unit and are not
          summed across pairs.
        </p>
      </div>
      <div className="p-4">
        {isError ? (
          <Alert variant="destructive" role="alert">
            <AlertTitle>Failed to load settlement items.</AlertTitle>
          </Alert>
        ) : (
          <DataTable
            columns={columns}
            data={tableData}
            isLoading={isLoading}
            emptyMessage="No token pair items"
          />
        )}
      </div>
    </section>
  );
}

/** 逐币对结算流水目标；明细金额精度沿用对应分项的源 Token。 */
interface SettleItemRecordsTarget {
  orderId: number;
  pairId: number;
  pairText: string;
  sourceTokenCode: string;
}

function SettleItemRecordsDialogContent({
  target,
}: {
  target: SettleItemRecordsTarget;
}) {
  const { data, isLoading, isError } = useSettleItemRecordsQuery(
    KISSEN_PROJECT_ID,
    target.orderId,
    target.pairId,
  );
  const list = data ?? [];
  const { decimalsOf } = useTokenMeta(KISSEN_PROJECT_ID);
  const decimals = decimalsOf(target.sourceTokenCode);

  if (isError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTitle>Failed to load settlement records.</AlertTitle>
      </Alert>
    );
  }

  return isLoading ? (
    <LoadingBlock />
  ) : list.length === 0 ? (
    <p className="py-6 text-center text-sm text-muted-foreground">
      No settlement records for this token pair within the order period
    </p>
  ) : (
    <div className="overflow-x-auto rounded-md border border-border/50 bg-card">
      <table className="w-full min-w-max caption-bottom text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className={GROUP_TH}>Tx No</th>
            <th className={`${GROUP_TH} text-right`}>Principal</th>
            <th className={`${GROUP_TH} text-right`}>Markup Amount</th>
            <th className={`${GROUP_TH} text-right`}>Admin Split</th>
            <th className={`${GROUP_TH} text-right`}>LP Split</th>
            <th className={GROUP_TH}>Record Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {list.map((row: SettleItemRecordRow, index: number) => (
            <tr
              key={row.txNo || `record-${index}`}
              className="motion-safe:transition-colors hover:bg-muted/50"
            >
              <td className={`${GROUP_TD} tabular-nums`}>{row.txNo || '-'}</td>
              <td className={`${GROUP_TD} text-right tabular-nums`}>
                {formatAmount(row.principal, decimals)}
              </td>
              <td className={`${GROUP_TD} text-right tabular-nums`}>
                {formatAmount(row.markupAmount, decimals)}
              </td>
              <td className={`${GROUP_TD} text-right tabular-nums`}>
                {formatAmount(row.adminSplitAmount, decimals)}
              </td>
              <td
                className={`${GROUP_TD} text-right font-semibold text-success tabular-nums`}
              >
                {formatAmount(row.lpSplitAmount, decimals)}
              </td>
              <td className={`${GROUP_TD} whitespace-nowrap tabular-nums`}>
                {formatTimestamp(row.recordTime)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SettleItemRecordsDialog({
  target,
  onClose,
}: {
  target: SettleItemRecordsTarget | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[780px]">
        <DialogHeader>
          <DialogTitle>
            Settlement Details — {target ? target.pairText : ''}
          </DialogTitle>
        </DialogHeader>
        {target ? (
          <SettleItemRecordsDialogContent
            key={`${target.orderId}-${target.pairId}`}
            target={target}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function SettleOrderListPage() {
  const router = useRouter();
  const toast = useToast();
  const { handleSubmit, reset, control } = useForm<SettleOrderFilterForm>({
    defaultValues: EMPTY_SETTLE_FILTER,
  });
  const [params, setParams] = React.useState(() =>
    settleFilterToParams(EMPTY_SETTLE_FILTER, 1, PAGE_SIZE_DEFAULT),
  );
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);
  const { data, isLoading, isError, dataUpdatedAt } = useSettleOrderListQuery(
    KISSEN_PROJECT_ID,
    params,
  );
  const { data: lpOptions } = useSettleLpOptionsQuery(KISSEN_PROJECT_ID);
  const confirmMutation = useSettleOrderConfirmMutation(KISSEN_PROJECT_ID);
  const voidMutation = useSettleOrderVoidMutation(KISSEN_PROJECT_ID);
  const mutationPending =
    confirmMutation.isPending || voidMutation.isPending;
  const [confirmTarget, setConfirmTarget] =
    React.useState<SettleOrderRow | null>(null);
  const [voidTarget, setVoidTarget] = React.useState<SettleOrderRow | null>(
    null,
  );
  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;

  const lpFilterOptions = React.useMemo(
    () => [
      optAll(),
      ...(lpOptions ?? []).map((lp) => ({
        value: String(lp.lpId),
        label: `${lp.lpName}(${lp.lpCode})`,
      })),
    ],
    [lpOptions],
  );

  const onSearch = (form: SettleOrderFilterForm) => {
    setParams(settleFilterToParams(form, 1, pageSize));
  };

  const onResetSearch = () => {
    reset(EMPTY_SETTLE_FILTER);
    setParams(settleFilterToParams(EMPTY_SETTLE_FILTER, 1, pageSize));
  };

  const onPageSizeChange = (nextPageSize: number) => {
    setPageSize(nextPageSize);
    setParams((prev) => ({
      ...prev,
      pageNum: 1,
      pageSize: nextPageSize,
    }));
  };

  const onConfirmSubmit = () => {
    if (!confirmTarget || mutationPending) return;
    confirmMutation.mutate(
      { orderId: confirmTarget.orderId },
      {
        onSuccess: () => {
          setConfirmTarget(null);
          toast.success('Settlement order confirmation approval submitted');
        },
        onError: (error) => toast.error((error as Error).message),
      },
    );
  };

  const onVoidSubmit = () => {
    if (!voidTarget || mutationPending) return;
    voidMutation.mutate(
      { orderId: voidTarget.orderId },
      {
        onSuccess: () => {
          setVoidTarget(null);
          toast.success('Voided');
        },
        onError: (error) => toast.error((error as Error).message),
      },
    );
  };

  const columns = React.useMemo<ColumnDef<SettleOrderRow & { id: string }>[]>(
    () => [
      {
        id: 'orderId',
        header: 'Statement ID',
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.orderId}</span>
        ),
      },
      {
        id: 'lpName',
        header: 'LP',
        cell: ({ row }) =>
          row.original.lpName || `LP #${row.original.lpId}`,
      },
      {
        id: 'periodType',
        header: 'Period',
        cell: ({ row }) => (
          <Badge variant="outline">
            {periodTypeLabel(row.original.periodType)}
          </Badge>
        ),
      },
      {
        id: 'periodRange',
        header: 'Period Range',
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatTimestamp(row.original.periodStart)} ~{' '}
            {formatTimestamp(row.original.periodEnd)}
          </span>
        ),
      },
      {
        id: 'transactions',
        header: () => <span className="block text-right">Transactions</span>,
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {row.original.txCount}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <ProtoStatusBadge
            tone={ORDER_STATUS_TONE[row.original.status] ?? 'muted'}
          >
            {SETTLE_ORDER_STATUS_LABEL[row.original.status] ??
              row.original.status}
          </ProtoStatusBadge>
        ),
      },
      {
        id: 'createTime',
        header: 'Created on',
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatTimestamp(row.original.createTime)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const order = row.original;
          return (
            <div className="flex items-center gap-3 whitespace-nowrap">
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() =>
                  router.push(`/settle/order/detail?id=${order.orderId}`)
                }
              >
                Details
              </Button>
              {order.status === 10 ? (
                <>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0"
                    disabled={mutationPending}
                    onClick={() => setConfirmTarget(order)}
                  >
                    Submit for Approval
                  </Button>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-destructive hover:text-destructive"
                    disabled={mutationPending}
                    onClick={() => setVoidTarget(order)}
                  >
                    Void
                  </Button>
                </>
              ) : null}
            </div>
          );
        },
      },
    ],
    [mutationPending, router],
  );
  const tableData = rows.map((row) => ({ ...row, id: String(row.orderId) }));

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border/60 bg-card">
        <div className="border-b border-border/50 px-4 py-3">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-base font-semibold leading-6 text-foreground">
              Settlement Statements
            </h1>
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
          onSubmit={handleSubmit(onSearch)}
          className="border-b border-border/50 px-4 py-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormSelect
              name="lpId"
              control={control}
              label="LP"
              placeholder="All"
              options={lpFilterOptions}
            />
            <FormSelect
              name="periodType"
              control={control}
              label="Period"
              placeholder="All"
              options={[
                optAll(),
                { value: '1', label: 'Daily' },
                { value: '2', label: 'Weekly' },
                { value: '3', label: 'Monthly' },
              ]}
            />
            <FormSelect
              name="status"
              control={control}
              label="Status"
              placeholder="All"
              options={[
                optAll(),
                ...SETTLE_ORDER_STATUS_VALUES.map((value) => ({
                  value: String(value),
                  label: SETTLE_ORDER_STATUS_LABEL[value] ?? String(value),
                })),
              ]}
            />
            <div className="flex items-end gap-2">
              <Button type="submit">Search</Button>
              <Button type="button" variant="outline" onClick={onResetSearch}>
                Reset
              </Button>
            </div>
          </div>
        </form>

        {isError ? (
          <div className="p-4">
            <Alert variant="destructive" role="alert">
              <AlertTitle>Failed to load. Refresh to retry.</AlertTitle>
            </Alert>
          </div>
        ) : (
          <div className="px-4 pb-4">
            <DataTable
              columns={columns}
              data={tableData}
              isLoading={isLoading}
              emptyMessage="No settle orders"
              pagination={
                paginationMeta
                  ? {
                      page: paginationMeta.page,
                      pageSize: paginationMeta.pageSize,
                      total: paginationMeta.total,
                      onPageChange: (page) =>
                        setParams((prev) => ({ ...prev, pageNum: page })),
                      onPageSizeChange,
                      pageSizeOptions: [10, 20, 50],
                    }
                  : undefined
              }
            />
          </div>
        )}
      </section>

      <AlertDialog
        open={!!confirmTarget}
        onOpenChange={(open) => {
          if (!open && !mutationPending) setConfirmTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit for Approval</AlertDialogTitle>
            <AlertDialogDescription>
              Submit settlement &quot;{confirmTarget?.orderId}&quot; for
              approval? The statement will be routed to the approval queue and
              cannot be edited while pending review.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutationPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={mutationPending}
              onClick={(event) => {
                event.preventDefault();
                onConfirmSubmit();
              }}
            >
              Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!voidTarget}
        onOpenChange={(open) => {
          if (!open && !mutationPending) setVoidTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void Settlement Order</AlertDialogTitle>
            <AlertDialogDescription>
              Void settlement order #{voidTarget?.orderId}? The same period can
              be regenerated once voided. Late-arriving transactions will be
              carried forward to the next period as adjustments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutationPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={mutationPending}
              onClick={(event) => {
                event.preventDefault();
                onVoidSubmit();
              }}
            >
              Void
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  const [editingLp, setEditingLp] = React.useState<LpRow | null>(null);
  const [cycleValue, setCycleValue] = React.useState('3');

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

  /** 打开周期编辑弹窗，并以该 LP 当前周期作为初始值。 */
  const onEditCycle = React.useCallback((row: LpRow) => {
    setEditingLp(row);
    setCycleValue(String(row.settleCycle ?? 3));
  }, []);

  /** 保存弹窗中的周期选择；失败时保留弹窗值供用户重试。 */
  const onSaveCycle = React.useCallback(
    () => {
      if (!editingLp) return;
      const cycle = Number(cycleValue);
      // STATIC-FILLER(GAP-ADM-06): 后端无批量保存端点，原型逐行 Save 语义按逐条提交实现。
      saveMutation.mutate(
        { lpId: editingLp.lpId, settleCycle: cycle },
        {
          onSuccess: () => {
            toast.success(
              `Settlement cycle for "${editingLp.lpName}" saved as ${SETTLE_CYCLE_MAP[cycle] ?? 'Monthly'}.`,
            );
            setEditingLp(null);
          },
          onError: (err) => {
            toast.error((err as Error).message);
          },
        },
      );
    },
    [cycleValue, editingLp, saveMutation, toast],
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
          const cycle = row.original.settleCycle ?? 3;
          return <span>{SETTLE_CYCLE_MAP[cycle] ?? String(cycle)}</span>;
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
          return (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEditCycle(lp)}
            >
              Edit
            </Button>
          );
        },
      },
    ],
    [onEditCycle],
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

      <Dialog
        open={editingLp !== null}
        onOpenChange={(open) => {
          if (!open) setEditingLp(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Settlement Cycle</DialogTitle>
            <DialogDescription>
              Changes take effect from the next settlement statement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">LP Name</div>
              <div className="text-sm text-muted-foreground">
                {editingLp?.lpName ?? '-'}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="edit-settlement-cycle"
                className="text-sm font-medium"
              >
                Settlement Cycle
              </label>
              <Select
                value={cycleValue}
                onValueChange={setCycleValue}
                disabled={saveMutation.isPending}
              >
                <SelectTrigger id="edit-settlement-cycle" className="w-full">
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
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingLp(null)}
              disabled={saveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={onSaveCycle}
              disabled={
                !editingLp ||
                Number(cycleValue) === (editingLp.settleCycle ?? 3) ||
                saveMutation.isPending
              }
            >
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
