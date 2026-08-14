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
  MockDetailPage,
  MockListPage,
  RadioGroup,
  RadioGroupItem,
  Skeleton,
  Textarea,
  useToast,
  type MockColumn,
  type MockField,
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
  return { value: ALL, label: '全部' };
}

function toNumberOrUndef(v: string | undefined): number | undefined {
  if (!v || v === ALL) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
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
    <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
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

/* ------------------------------------------------------------------ */
/* settle-record — 无独立源（settle-order 即结算记录），保留 mock 兜底   */
/* ------------------------------------------------------------------ */
// 无源功能，占位

const settleRecordColumns: MockColumn[] = [
  { key: 'recordId', label: '记录 ID' },
  { key: 'order', label: '结算单' },
  { key: 'type', label: '类型' },
  { key: 'amount', label: '金额' },
  { key: 'status', label: '状态' },
];

const settleRecordRows = [
  { id: '1', recordId: 'SR-1001', order: 'SO-2001', type: '分成划转', amount: '12,000.00', status: '成功' },
  { id: '2', recordId: 'SR-1002', order: 'SO-2002', type: '本金结算', amount: '8,500.00', status: '处理中' },
];

const settleRecordFields: MockField[] = [
  { key: 'recordId', label: '记录 ID' },
  { key: 'order', label: '结算单' },
  { key: 'type', label: '类型' },
  { key: 'amount', label: '金额' },
  { key: 'status', label: '状态' },
];

const settleRecordData = {
  id: '1',
  recordId: 'SR-1001',
  order: 'SO-2001',
  type: '分成划转',
  amount: '12,000.00',
  status: '成功',
};

export function SettleRecordListPage() {
  return (
    <MockListPage
      title="结算记录"
      columns={settleRecordColumns}
      rows={settleRecordRows}
    />
  );
}

export function SettleRecordDetailPage() {
  return (
    <MockDetailPage
      title="结算记录详情"
      fields={settleRecordFields}
      data={settleRecordData}
    />
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
          toast.success(`已生成结算单,单号 ${res.orderId}`);
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
          <DialogTitle>生成结算单</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormSelect
            name="lpId"
            control={control}
            label="LP"
            required
            placeholder="选择 LP"
            options={lpSelectOptions}
            error={errors.lpId ? '请选择 LP' : undefined}
          />
          <FormSelect
            name="periodType"
            control={control}
            label="周期类型"
            required
            placeholder="选择周期类型"
            options={[
              { value: '1', label: '日' },
              { value: '2', label: '周' },
              { value: '3', label: '月' },
            ]}
            error={errors.periodType ? '请选择周期类型' : undefined}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              name="periodStart"
              label="周期起"
              type="datetime-local"
              register={register('periodStart')}
            />
            <FormField
              name="periodEnd"
              label="周期止"
              type="datetime-local"
              register={register('periodEnd', {
                validate: (v, vals) => {
                  if (v && vals.periodStart) {
                    if (new Date(v).getTime() <= new Date(vals.periodStart).getTime()) {
                      return '周期止必须晚于周期起';
                    }
                  }
                  return true;
                },
              })}
              error={errors.periodEnd?.message}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            周期起止选填，留空用后端缺省周期窗口。
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={generateMutation.isPending}>
              生成
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
    setParams(settleFilterToParams(form, 1, PAGE_SIZE_DEFAULT));
  }, []);

  const onResetSearch = React.useCallback(() => {
    reset(EMPTY_SETTLE_FILTER);
    setParams(settleFilterToParams(EMPTY_SETTLE_FILTER, 1, PAGE_SIZE_DEFAULT));
  }, [reset]);

  /** 查看详情（有 GET detail 端点）。 */
  const onView = React.useCallback(
    (orderId: number) => router.push(`/settle-order/detail?id=${orderId}`),
    [router],
  );

  /** 提交确认审批（KSC）；仅 status 5/15 可点。 */
  const onConfirm = React.useCallback(
    (row: SettleOrderRow) => {
      if (!window.confirm(`确认提交结算单「${row.orderId}」确认审批?提交后进入审批中心待办。`))
        return;
      confirmMutation.mutate(
        { orderId: row.orderId },
        {
          onSuccess: () => toast.success('已提交结算单确认审批'),
          onError: (err) => toast.error((err as Error).message),
        },
      );
    },
    [confirmMutation, toast],
  );

  /** 发起分成划转（KST）；仅 status 20 可点。 */
  const onSplitTransfer = React.useCallback(
    (row: SettleOrderRow) => {
      if (!window.confirm(`确认对结算单「${row.orderId}」发起分成划转?提交后进入审批中心待办。`))
        return;
      splitSaveMutation.mutate(
        { orderId: row.orderId },
        {
          onSuccess: () => {
            // 跨域刷新：发起划转后结算单 status 由 20→35，源 index.vue onSplitTransfer 成功后 load()。
            queryClient.invalidateQueries({ queryKey: settleOrderKeys.lists(KISSEN_PROJECT_ID) });
            toast.success('已发起分成划转审批');
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
      header: '结算单 ID',
      cell: ({ row }) => <span>{row.original.orderId}</span>,
    },
    {
      accessorKey: 'lpName',
      header: 'LP',
      cell: ({ row }) => <span>{row.original.lpName || '--'}</span>,
    },
    {
      id: 'periodType',
      header: '周期类型',
      cell: ({ row }) => (
        <span>{SETTLE_PERIOD_TYPE_LABEL[row.original.periodType] ?? row.original.periodType}</span>
      ),
    },
    {
      id: 'periodRange',
      header: '周期起止',
      cell: ({ row }) => (
        <span>
          {formatTimestamp(row.original.periodStart)} ~ {formatTimestamp(row.original.periodEnd)}
        </span>
      ),
    },
    {
      accessorKey: 'txCount',
      header: '笔数',
      cell: ({ row }) => <span>{row.original.txCount}</span>,
    },
    {
      id: 'principalTotal',
      header: '本金合计',
      cell: ({ row }) => <span>{formatMoney(row.original.principalTotal)}</span>,
    },
    {
      id: 'markupTotal',
      header: '加价合计',
      cell: ({ row }) => <span>{formatMoney(row.original.markupTotal)}</span>,
    },
    {
      id: 'adminSplitTotal',
      header: '管理侧分成',
      cell: ({ row }) => <span>{formatMoney(row.original.adminSplitTotal)}</span>,
    },
    {
      id: 'lpSplitTotal',
      header: 'LP 分成',
      cell: ({ row }) => <span>{formatMoney(row.original.lpSplitTotal)}</span>,
    },
    {
      accessorKey: 'status',
      header: '状态',
      cell: ({ row }) => (
        <Badge variant={SETTLE_ORDER_STATUS_VARIANT[row.original.status] ?? 'outline'}>
          {SETTLE_ORDER_STATUS_LABEL[row.original.status] ?? row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'createTime',
      header: '创建时间',
      cell: ({ row }) => <span>{formatTimestamp(row.original.createTime)}</span>,
    },
    {
      id: 'actions',
      header: '操作',
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onView(item.orderId)}>
              查看
            </Button>
            {(item.status === 5 || item.status === 15) && (
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onConfirm(item)}>
                提交确认
              </Button>
            )}
            {item.status === 20 && (
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onSplitTransfer(item)}>
                发起分成划转
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
        className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="mb-4 text-sm font-semibold">查询</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormSelect
            name="lpId"
            control={control}
            label="LP"
            placeholder="全部"
            options={lpFilterOptions}
          />
          <FormSelect
            name="periodType"
            control={control}
            label="周期类型"
            placeholder="全部"
            options={[
              optAll(),
              { value: '1', label: '日' },
              { value: '2', label: '周' },
              { value: '3', label: '月' },
            ]}
          />
          <FormSelect
            name="status"
            control={control}
            label="状态"
            placeholder="全部"
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
          <Button type="submit">查询</Button>
          <Button type="button" variant="outline" onClick={onResetSearch}>
            重置
          </Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-3">
          <div className="text-sm font-semibold">结算单</div>
          <Button type="button" size="sm" onClick={() => setGenerateOpen(true)}>
            生成结算单
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          emptyMessage="暂无数据"
          pagination={
            paginationMeta
              ? {
                  page: paginationMeta.page,
                  pageSize: paginationMeta.pageSize,
                  total: paginationMeta.total,
                  onPageChange: (page) =>
                    setParams((prev) => ({ ...prev, pageNum: page })),
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
      <DetailCard title="结算单详情">
        <p className="text-sm text-muted-foreground">缺少结算单 ID。</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/settle-order')}>
          返回
        </Button>
      </DetailCard>
    );
  }

  return (
    <div className="space-y-4">
      <DetailCard title="结算单详情">
        {isLoading || !detail ? (
          <LoadingBlock />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DetailField label="结算单 ID">{detail.orderId}</DetailField>
            <DetailField label="LP">{detail.lpName || '--'}</DetailField>
            <DetailField label="周期类型">
              {SETTLE_PERIOD_TYPE_LABEL[detail.periodType] ?? detail.periodType}
            </DetailField>
            <DetailField label="状态">
              <Badge variant={SETTLE_ORDER_STATUS_VARIANT[detail.status] ?? 'outline'}>
                {SETTLE_ORDER_STATUS_LABEL[detail.status] ?? detail.status}
              </Badge>
            </DetailField>
            <DetailField label="周期起">{formatTimestamp(detail.periodStart)}</DetailField>
            <DetailField label="周期止">{formatTimestamp(detail.periodEnd)}</DetailField>
            <DetailField label="笔数">{detail.txCount}</DetailField>
            <DetailField label="审批记录 ID">{formatApprovalId(detail.approvalRecordId)}</DetailField>
            <DetailField label="本金合计">{formatMoney(detail.principalTotal)}</DetailField>
            <DetailField label="加价合计">{formatMoney(detail.markupTotal)}</DetailField>
            <DetailField label="管理侧分成">{formatMoney(detail.adminSplitTotal)}</DetailField>
            <DetailField label="LP 分成">{formatMoney(detail.lpSplitTotal)}</DetailField>
            <DetailField label="创建时间">{formatTimestamp(detail.createTime)}</DetailField>
          </div>
        )}
      </DetailCard>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push('/settle-order')}>
          返回
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
      orderId: toNumberOrUndef(form.orderId),
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
    setParams(splitFilterToParams(form, 1, PAGE_SIZE_DEFAULT));
  }, []);

  const onResetSearch = React.useCallback(() => {
    reset(EMPTY_SPLIT_FILTER);
    setParams(splitFilterToParams(EMPTY_SPLIT_FILTER, 1, PAGE_SIZE_DEFAULT));
  }, [reset]);

  const onView = React.useCallback(
    (transferId: number) => router.push(`/split-transfer/detail?id=${transferId}`),
    [router],
  );

  const columns = React.useMemo<ColumnDef<SplitTransferRow & { id: string }>[]>(() => [
    {
      id: 'transferId',
      header: '划转 ID',
      cell: ({ row }) => <span>{row.original.transferId}</span>,
    },
    {
      id: 'orderId',
      header: '结算单 ID',
      cell: ({ row }) => <span>{row.original.orderId}</span>,
    },
    {
      accessorKey: 'lpName',
      header: 'LP',
      cell: ({ row }) => <span>{row.original.lpName || '--'}</span>,
    },
    {
      accessorKey: 'direction',
      header: '方向',
      cell: ({ row }) => (
        <span>{SPLIT_DIRECTION_LABEL[row.original.direction] ?? row.original.direction}</span>
      ),
    },
    {
      accessorKey: 'currency',
      header: '币种',
      cell: ({ row }) => <span>{row.original.currency || '--'}</span>,
    },
    {
      accessorKey: 'amount',
      header: '金额',
      cell: ({ row }) => <span>{formatMoney(row.original.amount)}</span>,
    },
    {
      accessorKey: 'csTxId',
      header: '货币系统交易 ID',
      cell: ({ row }) => <span>{row.original.csTxId || '--'}</span>,
    },
    {
      accessorKey: 'status',
      header: '状态',
      cell: ({ row }) => (
        <Badge variant={SPLIT_STATUS_VARIANT[row.original.status] ?? 'outline'}>
          {SPLIT_STATUS_LABEL[row.original.status] ?? row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'createTime',
      header: '创建时间',
      cell: ({ row }) => <span>{formatTimestamp(row.original.createTime)}</span>,
    },
    {
      id: 'actions',
      header: '操作',
      cell: ({ row }) => (
        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onView(row.original.transferId)}>
          查看
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
        className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="mb-4 text-sm font-semibold">查询</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            name="orderId"
            label="结算单 ID"
            type="number"
            placeholder="精确匹配"
            register={register('orderId')}
          />
          <FormSelect
            name="lpId"
            control={control}
            label="LP"
            placeholder="全部"
            options={lpFilterOptions}
          />
          <FormSelect
            name="status"
            control={control}
            label="状态"
            placeholder="全部"
            options={[
              optAll(),
              { value: '1', label: '处理中' },
              { value: '2', label: '成功' },
              { value: '3', label: '失败' },
            ]}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">查询</Button>
          <Button type="button" variant="outline" onClick={onResetSearch}>
            重置
          </Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-6 py-3 text-sm font-semibold">分成划转</div>
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          emptyMessage="暂无数据"
          pagination={
            paginationMeta
              ? {
                  page: paginationMeta.page,
                  pageSize: paginationMeta.pageSize,
                  total: paginationMeta.total,
                  onPageChange: (page) =>
                    setParams((prev) => ({ ...prev, pageNum: page })),
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
 * detail 页承载：读取 transferId，经列表端点（pageSize 100）定位单行后展示。
 * 主查看路径仍为列表「查看」（与源一致），此页为路由标准化入口。
 */
export function SplitTransferDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const transferId = parseNum(searchParams.get('id'));

  // 无 GET detail 端点：经列表定位（diff/split 均无 by-PK 查询）。
  const { data, isLoading } = useSplitTransferListQuery(
    KISSEN_PROJECT_ID,
    { pageNum: 1, pageSize: 100, filter: {} },
    Boolean(transferId),
  );
  const row = data?.data.find((r) => r.transferId === transferId);

  if (!transferId) {
    return (
      <DetailCard title="分成划转详情">
        <p className="text-sm text-muted-foreground">缺少划转 ID。</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/split-transfer')}>
          返回
        </Button>
      </DetailCard>
    );
  }

  return (
    <div className="space-y-4">
      <DetailCard title="分成划转详情">
        {isLoading ? (
          <LoadingBlock />
        ) : !row ? (
          <p className="text-sm text-muted-foreground">未找到该划转记录。</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DetailField label="划转 ID">{row.transferId}</DetailField>
            <DetailField label="结算单 ID">{row.orderId}</DetailField>
            <DetailField label="LP">{row.lpName || '--'}</DetailField>
            <DetailField label="方向">
              {SPLIT_DIRECTION_LABEL[row.direction] ?? row.direction}
            </DetailField>
            <DetailField label="币种">{row.currency || '--'}</DetailField>
            <DetailField label="金额">{formatMoney(row.amount)}</DetailField>
            <DetailField label="货币系统交易 ID">{row.csTxId || '--'}</DetailField>
            <DetailField label="审批记录 ID">{formatApprovalId(row.approvalRecordId)}</DetailField>
            <DetailField label="状态">
              <Badge variant={SPLIT_STATUS_VARIANT[row.status] ?? 'outline'}>
                {SPLIT_STATUS_LABEL[row.status] ?? row.status}
              </Badge>
            </DetailField>
            <DetailField label="创建时间">{formatTimestamp(row.createTime)}</DetailField>
          </div>
        )}
      </DetailCard>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push('/split-transfer')}>
          返回
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
      transactionId: toNumberOrUndef(form.transactionId),
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
          toast.success(values.reviewAction === '2' ? '已确认差异' : '已忽略差异');
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
          <DialogTitle>处理对账差异</DialogTitle>
        </DialogHeader>
        <div className="mb-4 space-y-1.5 rounded-md border bg-muted/30 p-4 text-sm">
          <div><span className="text-muted-foreground">差异 ID：</span>{row.diffId}</div>
          <div><span className="text-muted-foreground">交易 ID：</span>{row.transactionId}</div>
          <div>
            <span className="text-muted-foreground">差异类型：</span>
            {RECONCILE_DIFF_TYPE_LABEL[row.diffType] ?? row.diffType}
          </div>
          <div><span className="text-muted-foreground">预期：</span>{row.expected || '--'}</div>
          <div><span className="text-muted-foreground">实际：</span>{row.actual || '--'}</div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              处理方式<span className="ml-0.5 text-destructive">*</span>
            </label>
            <Controller
              control={control}
              name="reviewAction"
              rules={{ required: '请选择处理方式' }}
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex gap-6"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="2" /> 确认
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="3" /> 忽略
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
            <label className="text-sm font-medium">备注</label>
            <Textarea
              rows={3}
              maxLength={200}
              placeholder="选填"
              {...register('reviewRemarks')}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={reviewMutation.isPending}>
              提交
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
      setParams(reconcileFilterToParams(form, 1, PAGE_SIZE_DEFAULT));
    },
    [],
  );

  const onResetSearch = React.useCallback(() => {
    const fresh = yesterdayFilter();
    reset(fresh);
    setReconDateStr(fresh.reconDate);
    setParams(reconcileFilterToParams(fresh, 1, PAGE_SIZE_DEFAULT));
  }, [reset]);

  /** 执行对账：确认守卫；reconDate 空走后端缺省（昨日）。 */
  const onRun = React.useCallback(() => {
    const dayMs = dateStrToDayStartMs(reconDateStr);
    const dayLabel = dayMs ? formatDay(dayMs) : '昨日(后端缺省)';
    if (
      !window.confirm(
        `确认对 ${dayLabel} 执行对账?该日已有待处理差异将被删除重建,已确认/已忽略保留。`,
      )
    )
      return;
    runMutation.mutate(
      { reconDate: dayMs },
      {
        onSuccess: (res) => {
          toast.success(`对账完成,发现 ${res.diffCount} 条差异`);
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
      header: '差异 ID',
      cell: ({ row }) => <span>{row.original.diffId}</span>,
    },
    {
      accessorKey: 'reconDate',
      header: '对账日期',
      cell: ({ row }) => <span>{formatDay(row.original.reconDate)}</span>,
    },
    {
      accessorKey: 'diffType',
      header: '差异类型',
      cell: ({ row }) => (
        <span>{RECONCILE_DIFF_TYPE_LABEL[row.original.diffType] ?? row.original.diffType}</span>
      ),
    },
    {
      accessorKey: 'transactionId',
      header: '交易 ID',
      cell: ({ row }) => <span>{row.original.transactionId}</span>,
    },
    {
      accessorKey: 'expected',
      header: '预期',
      cell: ({ row }) => <span>{row.original.expected || '--'}</span>,
    },
    {
      accessorKey: 'actual',
      header: '实际',
      cell: ({ row }) => <span>{row.original.actual || '--'}</span>,
    },
    {
      accessorKey: 'status',
      header: '状态',
      cell: ({ row }) => (
        <Badge variant={RECONCILE_DIFF_STATUS_VARIANT[row.original.status] ?? 'outline'}>
          {RECONCILE_DIFF_STATUS_LABEL[row.original.status] ?? row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'reviewUserName',
      header: '处理人',
      cell: ({ row }) => <span>{row.original.reviewUserName || '--'}</span>,
    },
    {
      accessorKey: 'reviewTime',
      header: '处理时间',
      cell: ({ row }) => (
        <span>{row.original.reviewTime === 0 ? '--' : formatTimestamp(row.original.reviewTime)}</span>
      ),
    },
    {
      id: 'actions',
      header: '操作',
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onView(item.diffId)}>
              查看
            </Button>
            {item.status === 1 && (
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setReviewRow(item)}>
                处理
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
        className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="mb-4 text-sm font-semibold">查询</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormField
            name="reconDate"
            label="对账日期"
            type="date"
            register={register('reconDate')}
          />
          <FormSelect
            name="diffType"
            control={control}
            label="差异类型"
            placeholder="全部"
            options={[
              optAll(),
              { value: '1', label: '时间轴缺失' },
              { value: '2', label: '结算流水缺失' },
              { value: '3', label: '金额不自洽' },
              { value: '4', label: '链路异常' },
            ]}
          />
          <FormSelect
            name="status"
            control={control}
            label="状态"
            placeholder="全部"
            options={[
              optAll(),
              { value: '1', label: '待处理' },
              { value: '2', label: '已确认' },
              { value: '3', label: '已忽略' },
            ]}
          />
          <FormField
            name="transactionId"
            label="交易 ID"
            type="number"
            placeholder="精确匹配"
            register={register('transactionId')}
          />
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button type="submit">查询</Button>
            <Button type="button" variant="outline" onClick={onResetSearch}>
              重置
            </Button>
          </div>
          <Button
            type="button"
            onClick={onRun}
            disabled={runMutation.isPending}
          >
            执行对账
          </Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-6 py-3 text-sm font-semibold">对账差异</div>
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          emptyMessage="暂无数据"
          pagination={
            paginationMeta
              ? {
                  page: paginationMeta.page,
                  pageSize: paginationMeta.pageSize,
                  total: paginationMeta.total,
                  onPageChange: (page) =>
                    setParams((prev) => ({ ...prev, pageNum: page })),
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
      <DetailCard title="对账差异详情">
        <p className="text-sm text-muted-foreground">缺少差异 ID。</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/reconcile')}>
          返回
        </Button>
      </DetailCard>
    );
  }

  return (
    <div className="space-y-4">
      <DetailCard title="对账差异详情">
        {isLoading ? (
          <LoadingBlock />
        ) : !row ? (
          <p className="text-sm text-muted-foreground">未找到该差异记录。</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DetailField label="差异 ID">{row.diffId}</DetailField>
            <DetailField label="对账日期">{formatDay(row.reconDate)}</DetailField>
            <DetailField label="差异类型">
              {RECONCILE_DIFF_TYPE_LABEL[row.diffType] ?? row.diffType}
            </DetailField>
            <DetailField label="交易 ID">{row.transactionId}</DetailField>
            <DetailField label="预期">{row.expected || '--'}</DetailField>
            <DetailField label="实际">{row.actual || '--'}</DetailField>
            <DetailField label="状态">
              <Badge variant={RECONCILE_DIFF_STATUS_VARIANT[row.status] ?? 'outline'}>
                {RECONCILE_DIFF_STATUS_LABEL[row.status] ?? row.status}
              </Badge>
            </DetailField>
            <DetailField label="处理人">{row.reviewUserName || '--'}</DetailField>
            <DetailField label="处理时间">
              {row.reviewTime === 0 ? '--' : formatTimestamp(row.reviewTime)}
            </DetailField>
            <DetailField label="备注">{row.reviewRemarks || '--'}</DetailField>
            <DetailField label="创建时间">{formatTimestamp(row.createTime)}</DetailField>
          </div>
        )}
      </DetailCard>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push('/reconcile')}>
          返回
        </Button>
      </div>
    </div>
  );
}
