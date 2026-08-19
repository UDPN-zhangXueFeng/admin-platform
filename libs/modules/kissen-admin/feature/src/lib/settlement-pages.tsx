'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { useQueryClient } from '@tanstack/react-query';

import {
  Badge,
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  RadioGroup,
  RadioGroupItem,
  Skeleton,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useToast,
} from '@myorg/shared/ui';
import { FormField, FormSelect } from '@myorg/shared/ui-forms';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  KISSEN_PROJECT_ID,
  RECONCILE_DIFF_STATUS_LABEL,
  RECONCILE_DIFF_STATUS_VARIANT,
  RECONCILE_DIFF_TYPE_LABEL,
  SETTLE_ORDER_STATUS_LABEL,
  SETTLE_ORDER_STATUS_VALUES,
  SETTLE_ORDER_STATUS_VARIANT,
  SETTLE_PERIOD_TYPE_LABEL,
  SPLIT_DIRECTION_LABEL,
  SPLIT_STATUS_LABEL,
  SPLIT_STATUS_VARIANT,
  settleOrderKeys,
  useReconcileDiffListQuery,
  useReconcileReviewMutation,
  useReconcileRunMutation,
  useSettleLpOptionsQuery,
  useSettleOrderConfirmMutation,
  useSettleOrderDetailQuery,
  useSettleOrderGenerateMutation,
  useSettleOrderListQuery,
  useSplitLpOptionsQuery,
  useSplitTransferListQuery,
  useSplitTransferSaveMutation,
  type ReconcileDiffRow,
  type SettleOrderRow,
  type SplitTransferRow,
} from '@myorg/modules/kissen-admin/data-access';
import { peekRow, stashRow } from './row-stash';

/* ============================================================ */
/* 共享格式化 / 展示辅助                                          */
/* ============================================================ */

const PAGE_SIZE_DEFAULT = 10;

/** 路由 search param → number（无效/缺失返回 undefined）。 */
function parseNum(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** 毫秒时间戳 → 本地 YYYY-MM-DD HH:mm:ss；0/空 → '--'（目标约定 §4）。 */
function formatTimestamp(ms: number | undefined | null): string {
  if (!ms) return '--';
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return '--';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 毫秒时间戳 → 本地 YYYY-MM-DD（对账日期列，源 formatDay）。 */
function formatDay(ms: number | undefined | null): string {
  if (!ms) return '--';
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return '--';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 数字千分位（保留原小数位）；源 approval/format.ts formatMoney。 */
function formatMoney(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '--';
  const s = String(v);
  const [int, dec] = s.split('.');
  const sign = int.startsWith('-') ? '-' : '';
  const digits = sign ? int.slice(1) : int;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec === undefined ? `${sign}${grouped}` : `${sign}${grouped}.${dec}`;
}

/** 审批记录 ID：!id → '--'（源 view-dialog 用 `!id ? '-' : id`，目标统一 '--'）。 */
function formatApprovalId(id: number | undefined): string {
  return !id ? '--' : String(id);
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

/**
 * 正整数过滤值：非数 / <=0 → undefined。
 * 对齐源 el-input-number :min="1"（split orderId、reconcile transactionId），
 * 避免 0/负数透传给后端。
 */
function positiveNumberOrUndef(v: string | undefined): number | undefined {
  const n = toNumberOrUndef(v);
  return n !== undefined && n >= 1 ? n : undefined;
}

/** 日期输入串 'YYYY-MM-DD' → 本地当日 00:00 毫秒（运营 GMT+8 口径，源 dayStart）。 */
function dateStrToDayStartMs(str: string): number | undefined {
  if (!str) return undefined;
  // 'YYYY-MM-DD' + 'T00:00:00' 解析为本地时间，与源 new Date(y,m,d).getTime() 一致。
  const t = new Date(`${str}T00:00:00`).getTime();
  return Number.isNaN(t) ? undefined : t;
}

/** 本地昨日 → 'YYYY-MM-DD'（对账筛选缺省，源 yesterday）。 */
function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
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

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
      <div className="mb-6 text-base font-semibold">{title}</div>
      {children}
    </section>
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

/** 生成结算单弹窗（源 generate-dialog.vue）。 */
function SettleOrderGenerateDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const { data: lpOptions } = useSettleLpOptionsQuery(KISSEN_PROJECT_ID, open);
  const generateMutation = useSettleOrderGenerateMutation(KISSEN_PROJECT_ID);

  interface GenerateForm {
    lpId: string;
    periodType: string;
    periodStart: string;
    periodEnd: string;
  }

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GenerateForm>({
    defaultValues: { lpId: '', periodType: '', periodStart: '', periodEnd: '' },
  });

  // 每次打开重置表单（避免上次残留）。
  React.useEffect(() => {
    if (open) {
      reset({ lpId: '', periodType: '', periodStart: '', periodEnd: '' });
    }
  }, [open, reset]);

  const lpSelectOptions = React.useMemo(
    () => (lpOptions ?? []).map((lp) => ({
      value: String(lp.lpId),
      label: `${lp.lpName}(${lp.lpCode})`,
    })),
    [lpOptions],
  );

  const onSubmit = handleSubmit((values) => {
    const lpId = Number(values.lpId);
    const periodType = Number(values.periodType);
    // 源 generate-dialog.vue rules：lpId/periodType 必填（「请选择 LP」「请选择周期类型」）。
    // FormSelect 不透传 Controller rules，按工单约定在提交处手动 guard。
    if (!Number.isFinite(lpId) || lpId <= 0) {
      toast.warning('Please select an LP');
      return;
    }
    if (!Number.isFinite(periodType) || periodType <= 0) {
      toast.warning('Please select a period type');
      return;
    }
    const periodStart = values.periodStart
      ? new Date(values.periodStart).getTime()
      : undefined;
    const periodEnd = values.periodEnd
      ? new Date(values.periodEnd).getTime()
      : undefined;
    generateMutation.mutate(
      { lpId, periodType, periodStart, periodEnd },
      {
        onSuccess: (res) => {
          toast.success(`Settlement order generated, order ID ${res.orderId}`);
          onClose();
        },
        onError: (err) => toast.error((err as Error).message),
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Generate Settlement Order</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormSelect
            name="lpId"
            control={control}
            label="LP"
            required
            placeholder="Select LP"
            options={lpSelectOptions}
            error={errors.lpId ? 'Please select an LP' : undefined}
          />
          <FormSelect
            name="periodType"
            control={control}
            label="Period Type"
            required
            placeholder="Select period type"
            options={[
              { value: '1', label: 'Daily' },
              { value: '2', label: 'Weekly' },
              { value: '3', label: 'Monthly' },
            ]}
            error={errors.periodType ? 'Please select a period type' : undefined}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              name="periodStart"
              label="Period Start"
              type="datetime-local"
              register={register('periodStart')}
            />
            <FormField
              name="periodEnd"
              label="Period End"
              type="datetime-local"
              register={register('periodEnd', {
                validate: (v, vals) => {
                  if (v && vals.periodStart) {
                    if (new Date(v).getTime() <= new Date(vals.periodStart).getTime()) {
                      return 'Period end must be later than period start';
                    }
                  }
                  return true;
                },
              })}
              error={errors.periodEnd?.message}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Period start and end are optional; leave blank to use the backend default period window.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={generateMutation.isPending}>
              Generate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SettleOrderListPage() {
  const router = useRouter();
  const toast = useToast();
  const { handleSubmit, reset, control } =
    useForm<SettleOrderFilterForm>({ defaultValues: EMPTY_SETTLE_FILTER });

  const [params, setParams] = React.useState(() =>
    settleFilterToParams(EMPTY_SETTLE_FILTER, 1, PAGE_SIZE_DEFAULT),
  );
  // 源 el-pagination page-sizes [10,20,50]：每页条数可切，切换即回第 1 页。
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);

  const { data, isLoading } = useSettleOrderListQuery(KISSEN_PROJECT_ID, params);
  const { data: lpOptions } = useSettleLpOptionsQuery(KISSEN_PROJECT_ID);
  const confirmMutation = useSettleOrderConfirmMutation(KISSEN_PROJECT_ID);
  const splitSaveMutation = useSplitTransferSaveMutation(KISSEN_PROJECT_ID);
  const queryClient = useQueryClient();

  const [generateOpen, setGenerateOpen] = React.useState(false);

  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;

  const lpFilterOptions = React.useMemo(
    () => [optAll(), ...(lpOptions ?? []).map((lp) => ({
      value: String(lp.lpId),
      label: `${lp.lpName}(${lp.lpCode})`,
    }))],
    [lpOptions],
  );

  const onSearch = React.useCallback((form: SettleOrderFilterForm) => {
    setParams(settleFilterToParams(form, 1, pageSize));
  }, [pageSize]);

  const onResetSearch = React.useCallback(() => {
    reset(EMPTY_SETTLE_FILTER);
    setParams(settleFilterToParams(EMPTY_SETTLE_FILTER, 1, pageSize));
  }, [reset, pageSize]);

  const onPageSizeChange = React.useCallback((n: number) => {
    setPageSize(n);
    setParams((prev) => ({ ...prev, pageNum: 1, pageSize: n }));
  }, []);

  /** 查看详情（有 GET detail 端点）。 */
  const onView = React.useCallback(
    (orderId: number) => router.push(`/settle-order/detail?id=${orderId}`),
    [router],
  );

  /** 提交确认审批（KSC）；仅 status 5/15 可点。 */
  const onConfirm = React.useCallback(
    (row: SettleOrderRow) => {
      if (!window.confirm(`Confirm submitting settlement order "${row.orderId}" for confirmation approval? It will enter the approval center to-do list after submission.`))
        return;
      confirmMutation.mutate(
        { orderId: row.orderId },
        {
          onSuccess: () => toast.success('Settlement order confirmation approval submitted'),
          onError: (err) => toast.error((err as Error).message),
        },
      );
    },
    [confirmMutation, toast],
  );

  /** 发起分成划转（KST）；仅 status 20 可点。 */
  const onSplitTransfer = React.useCallback(
    (row: SettleOrderRow) => {
      if (!window.confirm(`Confirm initiating a split transfer for settlement order "${row.orderId}"? It will enter the approval center to-do list after submission.`))
        return;
      splitSaveMutation.mutate(
        { orderId: row.orderId },
        {
          onSuccess: () => {
            // 跨域刷新：发起划转后结算单 status 由 20→35，源 index.vue onSplitTransfer 成功后 load()。
            queryClient.invalidateQueries({ queryKey: settleOrderKeys.lists(KISSEN_PROJECT_ID) });
            toast.success('Split transfer approval initiated');
          },
          onError: (err) => toast.error((err as Error).message),
        },
      );
    },
    [splitSaveMutation, queryClient, toast],
  );

  const columns = React.useMemo<ColumnDef<SettleOrderRow & { id: string }>[]>(() => [
    {
      id: 'orderId',
      header: 'Settlement Order ID',
      cell: ({ row }) => <span>{row.original.orderId}</span>,
    },
    {
      accessorKey: 'lpName',
      header: 'LP',
      cell: ({ row }) => <span>{row.original.lpName || '--'}</span>,
    },
    {
      id: 'periodType',
      header: 'Period Type',
      cell: ({ row }) => (
        <span>{SETTLE_PERIOD_TYPE_LABEL[row.original.periodType] ?? row.original.periodType}</span>
      ),
    },
    {
      id: 'periodRange',
      header: 'Period Start/End',
      cell: ({ row }) => (
        <span>
          {formatTimestamp(row.original.periodStart)} ~ {formatTimestamp(row.original.periodEnd)}
        </span>
      ),
    },
    {
      accessorKey: 'txCount',
      header: 'Txn Count',
      cell: ({ row }) => <span>{row.original.txCount}</span>,
    },
    {
      id: 'principalTotal',
      header: 'Principal Total',
      cell: ({ row }) => <span>{formatMoney(row.original.principalTotal)}</span>,
    },
    {
      id: 'markupTotal',
      header: 'Markup Total',
      cell: ({ row }) => <span>{formatMoney(row.original.markupTotal)}</span>,
    },
    {
      id: 'adminSplitTotal',
      header: 'Admin-Side Share',
      cell: ({ row }) => <span>{formatMoney(row.original.adminSplitTotal)}</span>,
    },
    {
      id: 'lpSplitTotal',
      header: 'LP Share',
      cell: ({ row }) => <span>{formatMoney(row.original.lpSplitTotal)}</span>,
    },
    {
      accessorKey: 'status',
      header: () => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>Status</span>
            </TooltipTrigger>
            <TooltipContent>Domain semantics: 5 Pending Review / 10 Under Review / 15 Rejected / 20 Confirmed / 35 Settled (labels reuse the common status map)</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
      cell: ({ row }) => (
        <Badge variant={SETTLE_ORDER_STATUS_VARIANT[row.original.status] ?? 'outline'}>
          {SETTLE_ORDER_STATUS_LABEL[row.original.status] ?? row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'createTime',
      header: 'Created At',
      cell: ({ row }) => <span>{formatTimestamp(row.original.createTime)}</span>,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onView(item.orderId)}>
              Details
            </Button>
            {(item.status === 5 || item.status === 15) && (
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onConfirm(item)}>
                Submit Confirmation
              </Button>
            )}
            {item.status === 20 && (
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onSplitTransfer(item)}>
                Initiate Split Transfer
              </Button>
            )}
          </div>
        );
      },
    },
  ], [onView, onConfirm, onSplitTransfer]);

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.orderId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSearch)}
        className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
      >
        <div className="mb-4 text-sm font-semibold">Search</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
            label="Period Type"
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
              ...SETTLE_ORDER_STATUS_VALUES.map((v) => ({
                value: String(v),
                label: SETTLE_ORDER_STATUS_LABEL[v] ?? String(v),
              })),
            ]}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">Search</Button>
          <Button type="button" variant="outline" onClick={onResetSearch}>
            Reset
          </Button>
        </div>
      </form>

      <div className="rounded-lg border-border/60 bg-card shadow-float">
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-3">
          <div className="text-sm font-semibold">Settlement Orders</div>
          <Button type="button" size="sm" onClick={() => setGenerateOpen(true)}>
            Generate Settlement Order
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          emptyMessage="No data"
          pagination={
            paginationMeta
              ? {
                  page: paginationMeta.page,
                  pageSize: paginationMeta.pageSize,
                  total: paginationMeta.total,
                  onPageChange: (page) =>
                    setParams((prev) => ({ ...prev, pageNum: page })),
                  onPageSizeChange,
                }
              : undefined
          }
        />
      </div>

      <SettleOrderGenerateDialog open={generateOpen} onClose={() => setGenerateOpen(false)} />
    </div>
  );
}

export function SettleOrderDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = parseNum(searchParams.get('id'));

  const { data: detail, isLoading } = useSettleOrderDetailQuery(
    KISSEN_PROJECT_ID,
    orderId,
  );

  if (!orderId) {
    return (
      <DetailCard title="Settlement Order Details">
        <p className="text-sm text-muted-foreground">Missing settlement order ID.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/settle-order')}>
          Back
        </Button>
      </DetailCard>
    );
  }

  return (
    <div className="space-y-4">
      <DetailCard title="Settlement Order Details">
        {isLoading || !detail ? (
          <LoadingBlock />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DetailField label="Settlement Order ID">{detail.orderId}</DetailField>
            <DetailField label="LP">{detail.lpName || '--'}</DetailField>
            <DetailField label="Period Type">
              {SETTLE_PERIOD_TYPE_LABEL[detail.periodType] ?? detail.periodType}
            </DetailField>
            <DetailField label="Status">
              <Badge variant={SETTLE_ORDER_STATUS_VARIANT[detail.status] ?? 'outline'}>
                {SETTLE_ORDER_STATUS_LABEL[detail.status] ?? detail.status}
              </Badge>
            </DetailField>
            <DetailField label="Period Start">{formatTimestamp(detail.periodStart)}</DetailField>
            <DetailField label="Period End">{formatTimestamp(detail.periodEnd)}</DetailField>
            <DetailField label="Txn Count">{detail.txCount}</DetailField>
            <DetailField label="Approval Record ID">{formatApprovalId(detail.approvalRecordId)}</DetailField>
            <DetailField label="Principal Total">{formatMoney(detail.principalTotal)}</DetailField>
            <DetailField label="Markup Total">{formatMoney(detail.markupTotal)}</DetailField>
            <DetailField label="Admin-Side Share">{formatMoney(detail.adminSplitTotal)}</DetailField>
            <DetailField label="LP Share">{formatMoney(detail.lpSplitTotal)}</DetailField>
            <DetailField label="Created At">{formatTimestamp(detail.createTime)}</DetailField>
          </div>
        )}
      </DetailCard>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push('/settle-order')}>
          Back
        </Button>
      </div>
    </div>
  );
}

/* ============================================================ */
/* split-transfer — 分成划转                                      */
/* ============================================================ */

interface SplitFilterForm {
  orderId: string;
  lpId: string;
  status: string;
}

const EMPTY_SPLIT_FILTER: SplitFilterForm = { orderId: '', lpId: ALL, status: ALL };

function splitFilterToParams(form: SplitFilterForm, pageNum: number, pageSize: number) {
  return {
    pageNum,
    pageSize,
    filter: {
      orderId: positiveNumberOrUndef(form.orderId),
      lpId: toNumberOrUndef(form.lpId),
      status: toNumberOrUndef(form.status),
    },
  };
}

export function SplitTransferListPage() {
  const router = useRouter();
  const { register, handleSubmit, reset, control } = useForm<SplitFilterForm>({
    defaultValues: EMPTY_SPLIT_FILTER,
  });

  const [params, setParams] = React.useState(() =>
    splitFilterToParams(EMPTY_SPLIT_FILTER, 1, PAGE_SIZE_DEFAULT),
  );
  // 源 el-pagination page-sizes [10,20,50]：每页条数可切，切换即回第 1 页。
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);

  const { data, isLoading } = useSplitTransferListQuery(KISSEN_PROJECT_ID, params);
  const { data: lpOptions } = useSplitLpOptionsQuery(KISSEN_PROJECT_ID);

  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;

  const lpFilterOptions = React.useMemo(
    () => [optAll(), ...(lpOptions ?? []).map((lp) => ({
      value: String(lp.lpId),
      label: `${lp.lpName}(${lp.lpCode})`,
    }))],
    [lpOptions],
  );

  const onSearch = React.useCallback((form: SplitFilterForm) => {
    setParams(splitFilterToParams(form, 1, pageSize));
  }, [pageSize]);

  const onResetSearch = React.useCallback(() => {
    reset(EMPTY_SPLIT_FILTER);
    setParams(splitFilterToParams(EMPTY_SPLIT_FILTER, 1, pageSize));
  }, [reset, pageSize]);

  const onPageSizeChange = React.useCallback((n: number) => {
    setPageSize(n);
    setParams((prev) => ({ ...prev, pageNum: 1, pageSize: n }));
  }, []);

  /** 查看：跳转前暂存行（源 view-dialog 直接传行对象；无 GET detail 端点）。 */
  const onView = React.useCallback(
    (row: SplitTransferRow) => {
      stashRow('settle-split', row.transferId, row);
      router.push(`/split-transfer/detail?id=${row.transferId}`);
    },
    [router],
  );

  const columns = React.useMemo<ColumnDef<SplitTransferRow & { id: string }>[]>(() => [
    {
      id: 'transferId',
      header: 'Transfer ID',
      cell: ({ row }) => <span>{row.original.transferId}</span>,
    },
    {
      id: 'orderId',
      header: 'Settlement Order ID',
      cell: ({ row }) => <span>{row.original.orderId}</span>,
    },
    {
      accessorKey: 'lpName',
      header: 'LP',
      cell: ({ row }) => <span>{row.original.lpName || '--'}</span>,
    },
    {
      accessorKey: 'direction',
      header: 'Direction',
      cell: ({ row }) => (
        <span>{SPLIT_DIRECTION_LABEL[row.original.direction] ?? row.original.direction}</span>
      ),
    },
    {
      accessorKey: 'currency',
      header: 'Currency',
      cell: ({ row }) => <span>{row.original.currency || '--'}</span>,
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ row }) => <span>{formatMoney(row.original.amount)}</span>,
    },
    {
      accessorKey: 'csTxId',
      header: 'Currency System Txn ID',
      cell: ({ row }) => <span>{row.original.csTxId || '--'}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={SPLIT_STATUS_VARIANT[row.original.status] ?? 'outline'}>
          {SPLIT_STATUS_LABEL[row.original.status] ?? row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'createTime',
      header: 'Created At',
      cell: ({ row }) => <span>{formatTimestamp(row.original.createTime)}</span>,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onView(row.original)}>
          Details
        </Button>
      ),
    },
  ], [onView]);

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.transferId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSearch)}
        className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
      >
        <div className="mb-4 text-sm font-semibold">Search</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            name="orderId"
            label="Settlement Order ID"
            type="number"
            min={1}
            placeholder="Exact Match"
            register={register('orderId')}
          />
          <FormSelect
            name="lpId"
            control={control}
            label="LP"
            placeholder="All"
            options={lpFilterOptions}
          />
          <FormSelect
            name="status"
            control={control}
            label="Status"
            placeholder="All"
            options={[
              optAll(),
              { value: '1', label: 'Processing' },
              { value: '2', label: 'Success' },
              { value: '3', label: 'Failed' },
            ]}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">Search</Button>
          <Button type="button" variant="outline" onClick={onResetSearch}>
            Reset
          </Button>
        </div>
      </form>

      <div className="rounded-lg border-border/60 bg-card shadow-float">
        <div className="border-b border-border/50 px-6 py-3 text-sm font-semibold">Split Transfers</div>
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          emptyMessage="No data"
          pagination={
            paginationMeta
              ? {
                  page: paginationMeta.page,
                  pageSize: paginationMeta.pageSize,
                  total: paginationMeta.total,
                  onPageChange: (page) =>
                    setParams((prev) => ({ ...prev, pageNum: page })),
                  onPageSizeChange,
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}

/**
 * 分成划转详情（只读）。
 *
 * 源 view-dialog.vue 接收整行对象（无 GET detail 端点）。目标按路由约定用独立
 * detail 页承载：列表跳转前 stashRow 暂存行，此页优先消费暂存行；缺失（直链/
 * 刷新）时回退经列表端点（pageSize 100）定位单行。此页为路由标准化入口。
 */
export function SplitTransferDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const transferId = parseNum(searchParams.get('id'));

  // 无 GET detail 端点：优先消费列表页暂存行，缺失再经列表扫描定位。
  const [stashedRow] = React.useState(() =>
    transferId !== undefined ? peekRow<SplitTransferRow>('settle-split', transferId) : null,
  );
  const { data, isLoading } = useSplitTransferListQuery(
    KISSEN_PROJECT_ID,
    { pageNum: 1, pageSize: 100, filter: {} },
    Boolean(transferId) && stashedRow === null,
  );
  const row = stashedRow ?? data?.data.find((r) => r.transferId === transferId) ?? null;

  if (!transferId) {
    return (
      <DetailCard title="Split Transfer Details">
        <p className="text-sm text-muted-foreground">Missing transfer ID.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/split-transfer')}>
          Back
        </Button>
      </DetailCard>
    );
  }

  return (
    <div className="space-y-4">
      <DetailCard title="Split Transfer Details">
        {isLoading ? (
          <LoadingBlock />
        ) : !row ? (
          <p className="text-sm text-muted-foreground">Transfer record not found.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DetailField label="Transfer ID">{row.transferId}</DetailField>
            <DetailField label="Settlement Order ID">{row.orderId}</DetailField>
            <DetailField label="LP">{row.lpName || '--'}</DetailField>
            <DetailField label="Direction">
              {SPLIT_DIRECTION_LABEL[row.direction] ?? row.direction}
            </DetailField>
            <DetailField label="Currency">{row.currency || '--'}</DetailField>
            <DetailField label="Amount">{formatMoney(row.amount)}</DetailField>
            <DetailField label="Currency System Txn ID">{row.csTxId || '--'}</DetailField>
            <DetailField label="Approval Record ID">{formatApprovalId(row.approvalRecordId)}</DetailField>
            <DetailField label="Status">
              <Badge variant={SPLIT_STATUS_VARIANT[row.status] ?? 'outline'}>
                {SPLIT_STATUS_LABEL[row.status] ?? row.status}
              </Badge>
            </DetailField>
            <DetailField label="Created At">{formatTimestamp(row.createTime)}</DetailField>
          </div>
        )}
      </DetailCard>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push('/split-transfer')}>
          Back
        </Button>
      </div>
    </div>
  );
}

/* ============================================================ */
/* reconcile — 对账差异                                          */
/* ============================================================ */

interface ReconcileFilterForm {
  reconDate: string;
  diffType: string;
  status: string;
  transactionId: string;
}

function yesterdayFilter(): ReconcileFilterForm {
  return { reconDate: yesterdayStr(), diffType: ALL, status: ALL, transactionId: '' };
}

function reconcileFilterToParams(
  form: ReconcileFilterForm,
  pageNum: number,
  pageSize: number,
) {
  return {
    pageNum,
    pageSize,
    filter: {
      reconDate: dateStrToDayStartMs(form.reconDate),
      diffType: toNumberOrUndef(form.diffType),
      status: toNumberOrUndef(form.status),
      transactionId: positiveNumberOrUndef(form.transactionId),
    },
  };
}

/** 处理差异弹窗（源 review-dialog.vue）。 */
function ReconcileReviewDialog({
  row,
  onClose,
}: {
  row: ReconcileDiffRow;
  onClose: () => void;
}) {
  const toast = useToast();
  const reviewMutation = useReconcileReviewMutation(KISSEN_PROJECT_ID);

  interface ReviewForm {
    reviewAction: '' | '2' | '3';
    reviewRemarks: string;
  }

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ReviewForm>({
    defaultValues: { reviewAction: '', reviewRemarks: '' },
  });

  const onSubmit = handleSubmit((values) => {
    if (values.reviewAction !== '2' && values.reviewAction !== '3') return;
    reviewMutation.mutate(
      {
        diffId: row.diffId,
        reviewAction: Number(values.reviewAction) as 2 | 3,
        reviewRemarks: values.reviewRemarks.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(values.reviewAction === '2' ? 'Diff confirmed' : 'Diff ignored');
          onClose();
        },
        onError: (err) => toast.error((err as Error).message),
      },
    );
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Review Recon Diff</DialogTitle>
        </DialogHeader>
        <div className="mb-4 space-y-1.5 rounded-md border bg-muted/30 p-4 text-sm">
          <div><span className="text-muted-foreground">Diff ID: </span>{row.diffId}</div>
          <div><span className="text-muted-foreground">Transaction ID: </span>{row.transactionId}</div>
          <div>
            <span className="text-muted-foreground">Diff Type: </span>
            {RECONCILE_DIFF_TYPE_LABEL[row.diffType] ?? row.diffType}
          </div>
          <div><span className="text-muted-foreground">Expected: </span>{row.expected || '--'}</div>
          <div><span className="text-muted-foreground">Actual: </span>{row.actual || '--'}</div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Review Action<span className="ml-0.5 text-destructive">*</span>
            </label>
            <Controller
              control={control}
              name="reviewAction"
              rules={{ required: 'Please select a review action' }}
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex gap-6"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="2" /> Confirm
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="3" /> Ignore
                  </label>
                </RadioGroup>
              )}
            />
            {errors.reviewAction && (
              <p className="text-sm text-destructive" role="alert">
                {errors.reviewAction.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Remarks</label>
            <Textarea
              rows={3}
              maxLength={200}
              placeholder="Optional"
              {...register('reviewRemarks')}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={reviewMutation.isPending}>
              Submit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReconcileListPage() {
  const router = useRouter();
  const toast = useToast();
  const { register, handleSubmit, reset, control } = useForm<ReconcileFilterForm>({
    defaultValues: yesterdayFilter(),
  });

  const [params, setParams] = React.useState(() =>
    reconcileFilterToParams(yesterdayFilter(), 1, PAGE_SIZE_DEFAULT),
  );
  // 源 el-pagination page-sizes [10,20,50]：每页条数可切，切换即回第 1 页。
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);
  // 独立持有 reconDate 串（执行对账与确认标签需要），与表单同步。
  const [reconDateStr, setReconDateStr] = React.useState(yesterdayStr());

  const { data, isLoading } = useReconcileDiffListQuery(KISSEN_PROJECT_ID, params);
  const runMutation = useReconcileRunMutation(KISSEN_PROJECT_ID);

  const [reviewRow, setReviewRow] = React.useState<ReconcileDiffRow | null>(null);

  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;

  const onSearch = React.useCallback(
    (form: ReconcileFilterForm) => {
      setReconDateStr(form.reconDate);
      setParams(reconcileFilterToParams(form, 1, pageSize));
    },
    [pageSize],
  );

  const onResetSearch = React.useCallback(() => {
    const fresh = yesterdayFilter();
    reset(fresh);
    setReconDateStr(fresh.reconDate);
    setParams(reconcileFilterToParams(fresh, 1, pageSize));
  }, [reset, pageSize]);

  const onPageSizeChange = React.useCallback((n: number) => {
    setPageSize(n);
    setParams((prev) => ({ ...prev, pageNum: 1, pageSize: n }));
  }, []);

  /** 执行对账：确认守卫；reconDate 空走后端缺省（昨日）。 */
  const onRun = React.useCallback(() => {
    const dayMs = dateStrToDayStartMs(reconDateStr);
    const dayLabel = dayMs ? formatDay(dayMs) : 'Yesterday (backend default)';
    if (
      !window.confirm(
        `Confirm running reconciliation for ${dayLabel}? Existing pending diffs for that day will be deleted and rebuilt; confirmed/ignored ones are kept.`,
      )
    )
      return;
    runMutation.mutate(
      { reconDate: dayMs },
      {
        onSuccess: (res) => {
          toast.success(`Reconciliation completed, ${res.diffCount} diff(s) found`);
          // 源 onRun 成功后回到首页查询（onSearch 等价）。
          setParams((prev) => ({ ...prev, pageNum: 1 }));
        },
        onError: (err) => toast.error((err as Error).message),
      },
    );
  }, [reconDateStr, runMutation, toast]);

  const onView = React.useCallback(
    (diffId: number) => router.push(`/reconcile/detail?id=${diffId}`),
    [router],
  );

  const columns = React.useMemo<ColumnDef<ReconcileDiffRow & { id: string }>[]>(() => [
    {
      id: 'diffId',
      header: 'Diff ID',
      cell: ({ row }) => <span>{row.original.diffId}</span>,
    },
    {
      accessorKey: 'reconDate',
      header: 'Recon Date',
      cell: ({ row }) => <span>{formatDay(row.original.reconDate)}</span>,
    },
    {
      accessorKey: 'diffType',
      header: 'Diff Type',
      cell: ({ row }) => (
        <span>{RECONCILE_DIFF_TYPE_LABEL[row.original.diffType] ?? row.original.diffType}</span>
      ),
    },
    {
      accessorKey: 'transactionId',
      header: 'Transaction ID',
      cell: ({ row }) => <span>{row.original.transactionId}</span>,
    },
    {
      accessorKey: 'expected',
      header: 'Expected',
      cell: ({ row }) => <span>{row.original.expected || '--'}</span>,
    },
    {
      accessorKey: 'actual',
      header: 'Actual',
      cell: ({ row }) => <span>{row.original.actual || '--'}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={RECONCILE_DIFF_STATUS_VARIANT[row.original.status] ?? 'outline'}>
          {RECONCILE_DIFF_STATUS_LABEL[row.original.status] ?? row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'reviewUserName',
      header: 'Reviewed By',
      cell: ({ row }) => <span>{row.original.reviewUserName || '--'}</span>,
    },
    {
      accessorKey: 'reviewTime',
      header: 'Review Time',
      cell: ({ row }) => (
        <span>{row.original.reviewTime === 0 ? '--' : formatTimestamp(row.original.reviewTime)}</span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onView(item.diffId)}>
              Details
            </Button>
            {item.status === 1 && (
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setReviewRow(item)}>
                Review
              </Button>
            )}
          </div>
        );
      },
    },
  ], [onView]);

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.diffId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSearch)}
        className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
      >
        <div className="mb-4 text-sm font-semibold">Search</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormField
            name="reconDate"
            label="Recon Date"
            type="date"
            register={register('reconDate')}
          />
          <FormSelect
            name="diffType"
            control={control}
            label="Diff Type"
            placeholder="All"
            options={[
              optAll(),
              { value: '1', label: 'Timeline Missing' },
              { value: '2', label: 'Settlement Record Missing' },
              { value: '3', label: 'Amount Mismatch' },
              { value: '4', label: 'Chain Anomaly' },
            ]}
          />
          <FormSelect
            name="status"
            control={control}
            label="Status"
            placeholder="All"
            options={[
              optAll(),
              { value: '1', label: 'Pending' },
              { value: '2', label: 'Confirmed' },
              { value: '3', label: 'Ignored' },
            ]}
          />
          <FormField
            name="transactionId"
            label="Transaction ID"
            type="number"
            min={1}
            placeholder="Exact Match"
            register={register('transactionId')}
          />
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button type="submit">Search</Button>
            <Button type="button" variant="outline" onClick={onResetSearch}>
              Reset
            </Button>
          </div>
          <Button
            type="button"
            onClick={onRun}
            disabled={runMutation.isPending}
          >
            Run Reconciliation
          </Button>
        </div>
      </form>

      <div className="rounded-lg border-border/60 bg-card shadow-float">
        <div className="border-b border-border/50 px-6 py-3 text-sm font-semibold">Recon Diffs</div>
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          emptyMessage="No data"
          pagination={
            paginationMeta
              ? {
                  page: paginationMeta.page,
                  pageSize: paginationMeta.pageSize,
                  total: paginationMeta.total,
                  onPageChange: (page) =>
                    setParams((prev) => ({ ...prev, pageNum: page })),
                  onPageSizeChange,
                }
              : undefined
          }
        />
      </div>

      {reviewRow && (
        <ReconcileReviewDialog row={reviewRow} onClose={() => setReviewRow(null)} />
      )}
    </div>
  );
}

/**
 * 对账差异详情（只读，标准化入口）。
 *
 * 源 reconcile 仅有「处理」动作弹窗（review-dialog），无独立只读详情。目标按路由
 * 约定补 detail 页：读取 diffId，经列表端点（pageSize 100）定位单行后只读展示
 * 全字段。源无 by-PK 查询端点，故沿用列表定位。
 */
export function ReconcileDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const diffId = parseNum(searchParams.get('id'));

  const { data, isLoading } = useReconcileDiffListQuery(
    KISSEN_PROJECT_ID,
    { pageNum: 1, pageSize: 100, filter: {} },
    Boolean(diffId),
  );
  const row = data?.data.find((r) => r.diffId === diffId);

  if (!diffId) {
    return (
      <DetailCard title="Recon Diff Details">
        <p className="text-sm text-muted-foreground">Missing diff ID.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/reconcile')}>
          Back
        </Button>
      </DetailCard>
    );
  }

  return (
    <div className="space-y-4">
      <DetailCard title="Recon Diff Details">
        {isLoading ? (
          <LoadingBlock />
        ) : !row ? (
          <p className="text-sm text-muted-foreground">Diff record not found.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DetailField label="Diff ID">{row.diffId}</DetailField>
            <DetailField label="Recon Date">{formatDay(row.reconDate)}</DetailField>
            <DetailField label="Diff Type">
              {RECONCILE_DIFF_TYPE_LABEL[row.diffType] ?? row.diffType}
            </DetailField>
            <DetailField label="Transaction ID">{row.transactionId}</DetailField>
            <DetailField label="Expected">{row.expected || '--'}</DetailField>
            <DetailField label="Actual">{row.actual || '--'}</DetailField>
            <DetailField label="Status">
              <Badge variant={RECONCILE_DIFF_STATUS_VARIANT[row.status] ?? 'outline'}>
                {RECONCILE_DIFF_STATUS_LABEL[row.status] ?? row.status}
              </Badge>
            </DetailField>
            <DetailField label="Reviewed By">{row.reviewUserName || '--'}</DetailField>
            <DetailField label="Review Time">
              {row.reviewTime === 0 ? '--' : formatTimestamp(row.reviewTime)}
            </DetailField>
            <DetailField label="Remarks">{row.reviewRemarks || '--'}</DetailField>
            <DetailField label="Created At">{formatTimestamp(row.createTime)}</DetailField>
          </div>
        )}
      </DetailCard>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push('/reconcile')}>
          Back
        </Button>
      </div>
    </div>
  );
}
