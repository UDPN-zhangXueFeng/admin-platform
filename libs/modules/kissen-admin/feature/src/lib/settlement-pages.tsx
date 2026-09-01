'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { ColumnDef } from '@tanstack/react-table';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useToast,
} from '@myorg/shared/ui';
import { formatAdminDateTime } from '@myorg/shared/util-dates';
import { FormSelect } from '@myorg/shared/ui-forms';

import {
  KISSEN_PROJECT_ID,
  LP_STATUS_LABEL,
  LP_STATUS_VARIANT,
  type LpListReq,
  SETTLE_CYCLE_MAP,
  SETTLE_ORDER_STATUS_LABEL,
  SETTLE_ORDER_STATUS_VARIANT,
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
  type LpRow,
  type SettleItemRecordRow,
  type SettleOrderItemRow,
  type SettleOrderRow,
} from '@myorg/modules/kissen-admin/data-access';

/* ============================================================ */
/* 共享格式化 / 展示辅助                                          */
/* ============================================================ */

const PAGE_SIZE_DEFAULT = 10;

/** 毫秒时间戳 → 本地 YYYY-MM-DD HH:mm:ss；0/空 → '--'（目标约定 §4）。 */
function formatTimestamp(ms: number | undefined | null): string {
  if (!ms) return '--';
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return '--';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
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
const GROUP_TH = 'h-10 px-4 text-left align-middle font-medium text-muted-foreground';
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

/** 结算单详情弹窗（源 view-dialog.vue；§G 裁决5：640px 只读弹窗，单据层无金额字段）。 */
function SettleOrderViewDialog({
  orderId,
  open,
  onClose,
}: {
  orderId: number;
  open: boolean;
  onClose: () => void;
}) {
  const { data: detail, isLoading } = useSettleOrderDetailQuery(
    KISSEN_PROJECT_ID,
    orderId,
    open,
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Settlement Order Details</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <LoadingBlock />
        ) : detail ? (
          <div className="space-y-4">
            {/* Hero Summary：结算单号 + 状态 + LP + 创建时间（§6.3） */}
            <section className="rounded-lg border border-border/60 bg-card px-4 py-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-base font-semibold leading-6 text-foreground">
                    Order #{detail.orderId}
                  </span>
                  <Badge variant={SETTLE_ORDER_STATUS_VARIANT[detail.status] ?? 'outline'}>
                    {SETTLE_ORDER_STATUS_LABEL[detail.status] ?? detail.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>LP · {detail.lpName || '--'}</span>
                  <span className="tabular-nums">
                    Created {formatTimestamp(detail.createTime)}
                  </span>
                </div>
              </div>
            </section>

            {/* 结算周期（核心信息） */}
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              <DetailField label="Period Type">
                {periodTypeLabel(detail.periodType)}
              </DetailField>
              <DetailField label="Txn Count">{detail.txCount}</DetailField>
              <DetailField label="Period Start">
                {formatTimestamp(detail.periodStart)}
              </DetailField>
              <DetailField label="Period End">{formatTimestamp(detail.periodEnd)}</DetailField>
            </div>

            {/* 审计（§6.3）：审批关联 */}
            <div className="border-t border-border/50 pt-4">
              <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                <DetailField label="Approval Record ID">
                  {formatApprovalId(detail.approvalRecordId)}
                </DetailField>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No data</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* 结算单分项面板（源 index.vue 展开行：meta 行 + token 对分项表，懒加载）。 */
function SettleOrderItemsPanel({
  order,
  onItemRecords,
}: {
  order: SettleOrderRow;
  /** 分项「Settlement details」：携 orderId + pairId 打开逐笔结算明细弹窗。 */
  onItemRecords: (item: SettleOrderItemRow) => void;
}) {
  const { data: items, isLoading } = useSettleOrderItemsQuery(
    KISSEN_PROJECT_ID,
    order.orderId,
  );
  const list = items ?? [];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{periodTypeLabel(order.periodType)}</Badge>
        <span className="tabular-nums">
          {formatTimestamp(order.periodStart)} ~ {formatTimestamp(order.periodEnd)}
        </span>
        <span aria-hidden>·</span>
        <span>
          {list.length || '--'} token pairs · {order.txCount} txns
        </span>
        <span className="ml-auto">
          Amounts are in each token pair&apos;s own currency unit and are not summed across pairs
        </span>
      </div>
      {isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : list.length === 0 ? (
        <div className="py-4 text-center text-sm text-muted-foreground">
          No token pair items
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/60 bg-card">
          <table className="w-full min-w-max caption-bottom text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className={GROUP_TH}>Token Pair Code</th>
                <th className={`${GROUP_TH} text-right`}>Txn Count</th>
                <th className={`${GROUP_TH} text-right`}>Principal Total</th>
                <th className={`${GROUP_TH} text-right`}>Markup Total</th>
                <th className={`${GROUP_TH} text-right`}>LP Share</th>
                <th className={`${GROUP_TH} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {list.map((item: SettleOrderItemRow) => (
                <tr key={item.itemId} className="motion-safe:transition-colors hover:bg-muted/50">
                  <td className={`${GROUP_TD} tabular-nums`}>{item.pairCode || '--'}</td>
                  <td className={`${GROUP_TD} text-right tabular-nums`}>{item.txCount}</td>
                  <td className={`${GROUP_TD} text-right tabular-nums`}>{formatMoney(item.principalTotal)}</td>
                  <td className={`${GROUP_TD} text-right tabular-nums`}>{formatMoney(item.markupTotal)}</td>
                  {/* 源 .highlight：LP 分成高亮绿 → 主题 green 语义色（禁止上游 hex 直写）。 */}
                  <td className={`${GROUP_TD} text-right font-semibold text-emerald-600 tabular-nums dark:text-emerald-400`}>
                    {formatMoney(item.lpSplitTotal)}
                  </td>
                  {/* 源 el-button link「结算明细」→ Settlement details（2026-08-28 cede878）。 */}
                  <td className={`${GROUP_TD} text-right`}>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      onClick={() => onItemRecords(item)}
                    >
                      Settlement details
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** 结算明细弹窗目标（源 detailCtx：orderId × pairId + 标题用 pairCode）。 */
interface SettleItemRecordsTarget {
  orderId: number;
  pairId: number;
  pairCode: string;
}

/**
 * 结算明细内容（源 index.vue detailRows 表：交易单号/本金/加价/管理分成/LP 分成/结算时间）。
 * 按 orderId×pairId 作 key 重挂载——换目标即清空旧数据重新查询（源 openItemRecords 语义）；
 * 失败静默（拦截层已 toast），无数据走空态文案；recordTime 毫秒转日期。
 */
function SettleItemRecordsDialogContent({ target }: { target: SettleItemRecordsTarget }) {
  const { data, isLoading } = useSettleItemRecordsQuery(
    KISSEN_PROJECT_ID,
    target.orderId,
    target.pairId,
  );
  const list = data ?? [];

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
          {list.map((row: SettleItemRecordRow, idx: number) => (
            <tr
              key={row.txNo || `record-${idx}`}
              className="motion-safe:transition-colors hover:bg-muted/50"
            >
              <td className={`${GROUP_TD} tabular-nums`}>{row.txNo || '-'}</td>
              <td className={`${GROUP_TD} text-right tabular-nums`}>{formatMoney(row.principal)}</td>
              <td className={`${GROUP_TD} text-right tabular-nums`}>{formatMoney(row.markupAmount)}</td>
              <td className={`${GROUP_TD} text-right tabular-nums`}>{formatMoney(row.adminSplitAmount)}</td>
              {/* 源 .highlight：LP 分成高亮绿 → 主题 green 语义色（禁止上游 hex 直写）。 */}
              <td className={`${GROUP_TD} text-right font-semibold text-emerald-600 tabular-nums dark:text-emerald-400`}>
                {formatMoney(row.lpSplitAmount)}
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

/** 结算明细弹窗（源 el-dialog width 780px，标题「结算明细 — {pairCode}」，无分页）。 */
function SettleItemRecordsDialog({
  target,
  onClose,
}: {
  target: SettleItemRecordsTarget | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[780px]">
        <DialogHeader>
          <DialogTitle>
            Settlement Details —{' '}
            {target ? target.pairCode || `pair #${target.pairId}` : ''}
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

/**
 * 扁平结算单表（源 v2.3.2 index.vue，2026-08-28 71c6077 撤 LP 分组折叠）：
 * expand / Order ID / LP / 周期 / 周期起止 / 笔数 / 状态 / 创建时间 / 操作。
 * LP 降为普通列，服务端分页扛量；token 对分项保留单层展开懒加载。
 */
function SettleOrdersTable({
  orders,
  expandedOrders,
  onToggleOrder,
  onView,
  onConfirm,
  onVoid,
  onItemRecords,
}: {
  orders: SettleOrderRow[];
  expandedOrders: ReadonlySet<number>;
  onToggleOrder: (orderId: number) => void;
  onView: (row: SettleOrderRow) => void;
  onConfirm: (row: SettleOrderRow) => void;
  onVoid: (row: SettleOrderRow) => void;
  onItemRecords: (order: SettleOrderRow, item: SettleOrderItemRow) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-border/50 bg-card">
      <table className="w-full min-w-max caption-bottom text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className={`${GROUP_TH} w-10`} />
            <th className={`${GROUP_TH} text-right`}>Order ID</th>
            <th className={GROUP_TH}>LP</th>
            <th className={GROUP_TH}>Period</th>
            <th className={GROUP_TH}>Period Range</th>
            <th className={`${GROUP_TH} text-right`}>Tx Count</th>
            <th className={GROUP_TH}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>Status</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Domain semantics: 10 Pending Confirmation / 20 Confirmed / 35 Settled / 45 Voided
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </th>
            <th className={GROUP_TH}>Created At</th>
            <th className={`${GROUP_TH} text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {orders.map((order) => {
            const expanded = expandedOrders.has(order.orderId);
            return (
              <React.Fragment key={order.orderId}>
                <tr className="motion-safe:transition-colors hover:bg-muted/50">
                  <td className={GROUP_TD}>
                    <button
                      type="button"
                      aria-label={expanded ? 'Collapse items' : 'Expand items'}
                      onClick={() => onToggleOrder(order.orderId)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <ChevronDown
                        className={`h-4 w-4 motion-safe:transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </td>
                  <td className={`${GROUP_TD} text-right tabular-nums`}>{order.orderId}</td>
                  <td className={GROUP_TD}>
                    {/* 源 show-overflow-tooltip：截断 + tooltip 兜底显全名。 */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block max-w-[220px] truncate">
                            {order.lpName || `LP #${order.lpId}`}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {order.lpName || `LP #${order.lpId}`}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </td>
                  <td className={GROUP_TD}>
                    <Badge variant="outline">{periodTypeLabel(order.periodType)}</Badge>
                  </td>
                  <td className={`${GROUP_TD} whitespace-nowrap tabular-nums`}>
                    {formatTimestamp(order.periodStart)} ~ {formatTimestamp(order.periodEnd)}
                  </td>
                  <td className={`${GROUP_TD} text-right tabular-nums`}>{order.txCount}</td>
                  <td className={GROUP_TD}>
                    <Badge variant={SETTLE_ORDER_STATUS_VARIANT[order.status] ?? 'outline'}>
                      {SETTLE_ORDER_STATUS_LABEL[order.status] ?? order.status}
                    </Badge>
                  </td>
                  <td className={`${GROUP_TD} whitespace-nowrap tabular-nums`}>{formatTimestamp(order.createTime)}</td>
                  <td className={`${GROUP_TD} text-right whitespace-nowrap`}>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0"
                        onClick={() => onView(order)}
                      >
                        View
                      </Button>
                      {order.status === 10 && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0"
                          onClick={() => onConfirm(order)}
                        >
                          Submit Confirmation
                        </Button>
                      )}
                      {order.status === 10 && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-destructive hover:text-destructive"
                          onClick={() => onVoid(order)}
                        >
                          Void
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
                {expanded && (
                  <tr>
                    <td colSpan={9} className="border-t border-border/50 bg-muted/30 px-4 py-3">
                      <SettleOrderItemsPanel
                        order={order}
                        onItemRecords={(item) => onItemRecords(order, item)}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** 结算单扁平表专用分页条（样式对齐 shared DataTable 分页；展开行表无法内嵌 DataTable 分页）。 */
function SettleOrderPager({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (n: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between px-4 pb-4">
      <div className="text-sm text-muted-foreground">Total {total} items</div>
      <div className="flex items-center gap-2">
        <Select
          value={String(pageSize)}
          onValueChange={(v) => onPageSizeChange(Number(v))}
        >
          <SelectTrigger className="h-8 w-[110px]" aria-label="Rows per page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[10, 20, 50].map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <PagerButton aria-label="First page" disabled={page <= 1} onClick={() => onPageChange(1)}>
          <ChevronsLeft className="h-4 w-4" />
        </PagerButton>
        <PagerButton aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </PagerButton>
        <PagerButton aria-label="Next page" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </PagerButton>
        <PagerButton aria-label="Last page" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}>
          <ChevronsRight className="h-4 w-4" />
        </PagerButton>
      </div>
    </div>
  );
}

function PagerButton({
  children,
  disabled,
  onClick,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        'inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background text-sm font-medium ' +
        'hover:bg-accent hover:text-accent-foreground ' +
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
        'disabled:pointer-events-none disabled:opacity-50'
      }
      {...rest}
    >
      {children}
    </button>
  );
}

export function SettleOrderListPage() {
  const toast = useToast();
  const { handleSubmit, reset, control } =
    useForm<SettleOrderFilterForm>({ defaultValues: EMPTY_SETTLE_FILTER });

  const [params, setParams] = React.useState(() =>
    settleFilterToParams(EMPTY_SETTLE_FILTER, 1, PAGE_SIZE_DEFAULT),
  );
  // 源 el-pagination page-sizes [10,20,50]：每页条数可切，切换即回第 1 页。
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);

  const { data, isLoading, isError, dataUpdatedAt } = useSettleOrderListQuery(KISSEN_PROJECT_ID, params);
  const { data: lpOptions } = useSettleLpOptionsQuery(KISSEN_PROJECT_ID);
  const confirmMutation = useSettleOrderConfirmMutation(KISSEN_PROJECT_ID);
  const voidMutation = useSettleOrderVoidMutation(KISSEN_PROJECT_ID);

  const [viewTarget, setViewTarget] = React.useState<SettleOrderRow | null>(null);
  const [confirmTarget, setConfirmTarget] = React.useState<SettleOrderRow | null>(null);
  const [voidTarget, setVoidTarget] = React.useState<SettleOrderRow | null>(null);
  const [itemRecordsTarget, setItemRecordsTarget] =
    React.useState<SettleItemRecordsTarget | null>(null);

  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;

  const lpFilterOptions = React.useMemo(
    () => [optAll(), ...(lpOptions ?? []).map((lp) => ({
      value: String(lp.lpId),
      label: `${lp.lpName}(${lp.lpCode})`,
    }))],
    [lpOptions],
  );

  /** 单据层展开（token 对分项懒加载），orderId 维度记忆。 */
  const [expandedOrders, setExpandedOrders] = React.useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const onToggleOrder = React.useCallback((orderId: number) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  }, []);

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

  /** 提交确认（源 ElMessageBox warning → AlertDialog；仅 status 10，进入 KSC 审批）。 */
  const onConfirmSubmit = React.useCallback(
    (row: SettleOrderRow) => {
      setConfirmTarget(null);
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

  /** 作废重开（源 ElMessageBox warning → AlertDialog；仅 status 10 → 45，同周期可重新生成）。 */
  const onVoidSubmit = React.useCallback(
    (row: SettleOrderRow) => {
      setVoidTarget(null);
      voidMutation.mutate(
        { orderId: row.orderId },
        {
          onSuccess: () => toast.success('Voided'),
          onError: (err) => toast.error((err as Error).message),
        },
      );
    },
    [voidMutation, toast],
  );

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border/60 bg-card">
        {/* 生成入口已撤（源 36298ec）：KISSEN_SETTLEMENT_ORDER_GEN 按结算周期自动生成，页面不触发。 */}
        <div className="border-b border-border/50 px-4 py-3">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              Settlement Orders
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
        ) : isLoading && !rows.length ? (
          <div className="p-6">
            <LoadingBlock />
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No settle orders
          </div>
        ) : (
          <div className="px-4 pb-4">
            <SettleOrdersTable
              orders={rows}
              expandedOrders={expandedOrders}
              onToggleOrder={onToggleOrder}
              onView={(row) => setViewTarget(row)}
              onConfirm={(row) => setConfirmTarget(row)}
              onVoid={(row) => setVoidTarget(row)}
              onItemRecords={(order, item) =>
                setItemRecordsTarget({
                  orderId: order.orderId,
                  pairId: item.pairId,
                  pairCode: item.pairCode,
                })
              }
            />
          </div>
        )}

        {paginationMeta ? (
          <SettleOrderPager
            page={paginationMeta.page}
            pageSize={paginationMeta.pageSize}
            total={paginationMeta.total}
            onPageChange={(page) => setParams((prev) => ({ ...prev, pageNum: page }))}
            onPageSizeChange={onPageSizeChange}
          />
        ) : null}
      </section>

      <SettleItemRecordsDialog
        target={itemRecordsTarget}
        onClose={() => setItemRecordsTarget(null)}
      />
      {viewTarget ? (
        <SettleOrderViewDialog
          orderId={viewTarget.orderId}
          open
          onClose={() => setViewTarget(null)}
        />
      ) : null}

      {/* 提交确认（源 ElMessageBox warning：提交后进入审批中心待办）。 */}
      <AlertDialog
        open={!!confirmTarget}
        onOpenChange={(v) => {
          if (!v) setConfirmTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              Submit settlement order &quot;{confirmTarget?.orderId}&quot; for confirmation
              approval? It will enter the approval center to-do list after submission.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmTarget && onConfirmSubmit(confirmTarget)}>
              Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 作废（源 ElMessageBox warning：作废后同周期可重新生成，追溯流水归下期调整项）。 */}
      <AlertDialog
        open={!!voidTarget}
        onOpenChange={(v) => {
          if (!v) setVoidTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void Settlement Order</AlertDialogTitle>
            <AlertDialogDescription>
              Void settlement order #{voidTarget?.orderId}? The same period can be
              regenerated after voiding; retrospective transactions are carried forward
              to the next period as adjustments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => voidTarget && onVoidSubmit(voidTarget)}
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
/* settle-cycle — 结算周期配置                                     */
/* ============================================================ */

/** 状态 Tab（源 viewTab：approved=审核通过默认 / others=未生效·已驳回，notApproved 布尔）。 */
type CycleViewTab = 'approved' | 'others';

interface CycleParams {
  pageNum: number;
  pageSize: number;
  lpName?: string;
  notApproved: boolean;
}

export function SettleCycleListPage() {
  const toast = useToast();
  const [lpNameInput, setLpNameInput] = React.useState('');
  const [viewTab, setViewTab] = React.useState<CycleViewTab>('approved');
  const [params, setParams] = React.useState<CycleParams>({
    pageNum: 1,
    pageSize: PAGE_SIZE_DEFAULT,
    lpName: undefined,
    notApproved: false,
  });

  const queryParams = React.useMemo<LpListReq>(
    () => ({
      pageNum: params.pageNum,
      pageSize: params.pageSize,
      filter: { lpName: params.lpName, notApproved: params.notApproved },
    }),
    [params],
  );

  const { data, isLoading, isError, dataUpdatedAt } = useLpSettleCycleListQuery(KISSEN_PROJECT_ID, queryParams);
  const saveMutation = useLpSettleCycleSaveMutation(KISSEN_PROJECT_ID);

  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;

  /** 源 onSearch：回第 1 页并提交 lpName（模糊匹配）。Tab 值随 load 一起提交（源语义：切 Tab 后点查询生效）。 */
  const onSearch = React.useCallback(() => {
    setParams((prev) => ({
      ...prev,
      pageNum: 1,
      lpName: lpNameInput.trim() || undefined,
      notApproved: viewTab === 'others',
    }));
  }, [lpNameInput, viewTab]);

  /** 源 onReset：仅清 lpName，状态 Tab 保持不动。 */
  const onReset = React.useCallback(() => {
    setLpNameInput('');
    setParams((prev) => ({ ...prev, pageNum: 1, lpName: undefined }));
  }, []);

  /**
   * 行内下拉直接改周期（源 saveCycle）：成功 toast「{lpName} 已设为{周期}，自下一张结算单生效」；
   * 显示值不做乐观更新——mutation onSuccess 失效 lp 列表带回库内新值，失败仅 toast
   * （源失败 load() 回显库内值，此处显示值从未变更，语义等价）。
   */
  const onSaveCycle = React.useCallback(
    (row: LpRow, cycle: number) => {
      saveMutation.mutate(
        { lpId: row.lpId, settleCycle: cycle },
        {
          onSuccess: () => {
            toast.success(
              `${row.lpName} set to ${SETTLE_CYCLE_MAP[cycle] ?? 'Monthly'}, effective from the next settlement order`,
            );
          },
          onError: (err) => toast.error((err as Error).message),
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
        cell: ({ row }) => <span>{row.original.contactName || '--'}</span>,
      },
      {
        id: 'settleCycle',
        header: () => (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  Settlement Cycle
                  <span className="ml-0.5 text-destructive">*</span>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Saves on selection; takes effect from the next settlement order (monthly by default)
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ),
        cell: ({ row }) => {
          const lp = row.original;
          return (
            <Select
              value={String(lp.settleCycle ?? 3)}
              onValueChange={(v) => onSaveCycle(lp, Number(v))}
            >
              <SelectTrigger className="h-8 w-[110px]" aria-label={`Settlement cycle of ${lp.lpName}`}>
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
        cell: ({ row }) => (
          <Badge variant={LP_STATUS_VARIANT[row.original.status] ?? 'outline'}>
            {LP_STATUS_LABEL[row.original.status] ?? row.original.status}
          </Badge>
        ),
      },
    ],
    [onSaveCycle],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.lpId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      {/* 页头 info alert（源 el-alert info：按 LP 配置周期，默认月结，下一张结算单生效）。 */}
      <Alert>
        <AlertDescription>
          Configure the settlement order generation cycle per LP (daily/weekly/monthly,
          monthly by default); changes take effect from the next settlement order.
        </AlertDescription>
      </Alert>

      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              LP Settlement Cycles
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
              <Input
                id="settle-cycle-lp-name"
                value={lpNameInput}
                placeholder="Fuzzy match"
                className="w-full"
                onChange={(e) => setLpNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSearch();
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium leading-snug text-foreground">
                Status
              </label>
              <RadioGroup
                value={viewTab}
                onValueChange={(v) => setViewTab(v as CycleViewTab)}
                className="flex h-10 items-center gap-4"
              >
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="approved" /> Approved
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="others" /> Inactive / Rejected
                </label>
              </RadioGroup>
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
              emptyMessage="No LPs found"
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
