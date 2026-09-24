'use client';

/**
 * 交易域页面（原型 FxTransactionsPage / FxTransactionDetailsPage；上游
 * `views/transfer/tx/**` v2.0-tokenization）。
 *
 * - TxListListPage：/transfer/tx 全状态单页。7 平铺筛选（单号/Token 对/LP/
 *   状态/创建日期区间/源/目标银行）+ 全列可排序（Tokens/From/To 除外）+
 *   Completed on (UTC+8) 真实列（completedTime，0=未完成 → Dash）。
 * - TxDetailPage：/transfer/tx/detail?id=。左 8/12（Settlement Overview /
 *   Transaction Information / Timing）+ 右 4/12（Clearance Pipeline 七节点）。
 * - ResolveDialog（EXCEPTION 70 行处置）与 TransactionStatusAlert（真实
 *   failReason 载体）保留。
 *
 * 导出（registry 依赖，名字不可改）：TxListListPage / TxDetailPage。
 */

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Controller,
  useForm,
  type Control,
  type FieldValues,
  type Path,
} from 'react-hook-form';
import { ColumnDef } from '@tanstack/react-table';
import {
  ArrowLeft,
  ArrowLeftRight,
  Check,
  ChevronsUpDown,
  Clock3,
  Copy,
  FileText,
  MoreVertical,
  Repeat,
  Workflow,
  X,
} from 'lucide-react';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RadioGroup,
  RadioGroupItem,
  ScrollArea,
  Skeleton,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useToast,
} from '@myorg/shared/ui';
import { FormField, FormSelect, type SelectOption } from '@myorg/shared/ui-forms';
import { cn } from '@myorg/shared/util-classnames';
import { formatAdminDateTime } from '@myorg/shared/util-dates';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  KISSEN_PROJECT_ID,
  TX_STATUS_OPTIONS,
  useResolveTransactionMutation,
  useTransactionBankOptionsQuery,
  useTransactionDetailQuery,
  useTransactionListQuery,
  useTransactionLpOptionsQuery,
  useTransactionPairOptionsQuery,
  useTokenMeta,
  type TransactionDetailRow,
  type TransactionPageFilter,
  type TransactionRow,
} from '@myorg/modules/kissen-admin/data-access';

import { formatAmount } from './format';
import {
  formatDuration,
  formatPercent,
  formatRate,
  formatTokenAmount,
  formatUtc8,
} from './proto-format';
import { PROTO_TX_STATUS, protoStatusLabel, protoStatusRank } from './proto-enums';
import { CopyableId, Dash, ProtoStatusBadge, type ProtoStatusTone } from './proto-ui';
import {
  ProtoSortHeader,
  useProtoSort,
  type ProtoSortGetter,
} from './proto-sort';

/** 列表路由（registry `/transfer/tx`；列表 View 跳转与详情 Back 共用）。 */
const TX_LIST_PATH = '/transfer/tx';

/* ================================================================== */
/* 展示工具                                                            */
/* ================================================================== */

/**
 * 金额展示：千分位 + 按该行 token decimalDigits 固定位小数 HALF_UP（纯字符串
 * BigInt，不经 Number）；dec 缺省回退 2（token DDL 默认）。sym 仅在金额有效
 * （≠'-'）时追加——无效金额不拼符号。
 */
function fmtAmount(
  v: number | string | null | undefined,
  sym?: string,
  dec?: number,
): string {
  const text = formatAmount(v, dec ?? 2);
  return sym && text !== '-' ? `${text} ${sym}` : text;
}



function pairText(source?: string, target?: string): string {
  return source && target ? `${source}→${target}` : '-';
}

/** 空值兜底展示（源 `|| '-'` 口径）。 */
function orDash(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '-';
  return String(v);
}

/* ================================================================== */
/* 结算干线（列表 Completed 列 + 详情 Clearance Pipeline 共用口径）      */
/* ================================================================== */

/** 主线 7 节点：35 即成功终态「Completed」（40 仅历史数据，按终点渲染）。 */
const RAIL_MAIN_LINE: ReadonlyArray<{ code: number; name: string }> = [
  { code: 1, name: 'Created' },
  { code: 5, name: 'Quoted' },
  { code: 10, name: 'Confirmed' },
  { code: 20, name: 'Source Transferring' },
  { code: 25, name: 'Source Verified' },
  { code: 30, name: 'Advancing' },
  { code: 35, name: 'Completed' },
];

/** 原型干线 7 步展示名（R5；第 6 步原型口径叫 Processing）。 */
const PIPELINE_STEP_NAMES = [
  'Created',
  'Quoted',
  'Confirmed',
  'Source Transferring',
  'Source Verified',
  'Processing',
  'Completed',
] as const;

/** 分支终态：forkCode 是离开主线前最后经过的主线节点（近似分叉位置）。 */
const RAIL_BRANCH: Record<number, { name: string; forkCode: number }> = {
  50: { name: 'Reversing', forkCode: 25 },
  60: { name: 'Reversed', forkCode: 25 },
  70: { name: 'Exception', forkCode: 30 },
  80: { name: 'Cancelled', forkCode: 10 },
  90: { name: 'Failed', forkCode: 20 },
};

/**
 * 逐阶段说明（原型 RAIL_STEP_INFO 逐字迁移；R4/D11/D16）。
 * STATIC-FILLER(GAP-ADM-08): 原型 demo 展示文案（描述/操作者/相对秒），后端
 * 无逐节点时刻与操作者 API，仅 Created/Completed 两步用真实时间戳。
 */
const RAIL_STEP_INFO: Record<
  (typeof PIPELINE_STEP_NAMES)[number],
  { description: string; operator: string; deltaSec: number }
> = {
  Created: {
    description: 'Intent initiated by TD3 commercial router',
    operator: 'kissen-engine',
    deltaSec: 0,
  },
  Quoted: {
    description: 'Demo LP locked rate 0.9901 USD12 (+5s)',
    operator: 'kissen-engine',
    deltaSec: 5,
  },
  Confirmed: {
    description: 'Both financial entities co-signed deal ticket',
    operator: 'kissen-engine',
    deltaSec: 8,
  },
  'Source Transferring': {
    description: '10.10 CF7 locked in escrow contract',
    operator: 'kissen-bridge',
    deltaSec: 20,
  },
  'Source Verified': {
    description: 'Cryptographic proof validated on validator node',
    operator: 'bank-gateway',
    deltaSec: 32,
  },
  Processing: {
    description: 'Cross-ledger swap executed synchronously',
    operator: 'kissen-settler',
    deltaSec: 45,
  },
  Completed: {
    description: '10.00 USD12 released to 0x95a8…1050',
    operator: 'kissen-settler',
    deltaSec: 52,
  },
};

/** 状态码 → 主线推进位（分支态取 forkCode 位；未知态按 0）。 */
function pipelineIndexOf(status: number): number {
  const branch = RAIL_BRANCH[status];
  if (branch) {
    return RAIL_MAIN_LINE.findIndex((n) => n.code === branch.forkCode);
  }
  const curIdx =
    status === 40
      ? RAIL_MAIN_LINE.length - 1
      : RAIL_MAIN_LINE.findIndex((n) => n.code === status);
  return curIdx < 0 ? 0 : curIdx;
}

type PipelineState = 'done' | 'future' | 'danger' | 'muted' | 'warning';

/** 节点状态口径（R5 railState：已走过 done / 当前按状态 / 未到达 future）。 */
function pipelineStateOf(
  status: number,
  index: number,
  currentIndex: number,
): PipelineState {
  if (index < currentIndex) return 'done';
  if (index > currentIndex) return 'future';
  if (status === 35 || status === 40) return 'done';
  if (status === 70 || status === 90) return 'danger';
  if (status === 50 || status === 60 || status === 80) return 'muted';
  return 'warning';
}

/** 时间线节点圆（done=success 实心 / danger+X / warning 实心 / muted / 未到=空心）。 */
const NODE_STYLES: Record<PipelineState, string> = {
  done: 'bg-success',
  danger: 'bg-destructive',
  warning: 'bg-warning',
  muted: 'bg-muted',
  future: 'border-2 border-border bg-background',
};

/** 节点状态文字（done → Completed / 推进中 → In Progress / 未到 → Pending；末步完成改显 Finalized 徽章）。 */
const STEP_STATE_TEXT: Partial<
  Record<PipelineState, { text: string; className: string }>
> = {
  done: { text: 'Completed', className: 'text-success' },
  warning: { text: 'In Progress', className: 'text-warning' },
  future: { text: 'Pending', className: 'text-muted-foreground' },
};

/** 交易状态 → 原型语义色（FxTransactionsPage STATUS_TONES 同款，13 态）。 */
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


/* ================================================================== */
/* 通用展示组件                                                        */
/* ================================================================== */

/** 详情描述字段（el-descriptions-item 的 React 等价；span=长文本单独占行，§6.3）。 */
function DescField({
  label,
  span = false,
  children,
}: {
  label: string;
  /** 自 sm 断点起跨满两列（长文本/备注类字段）。 */
  span?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1', span && 'sm:col-span-2')}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

/**
 * 可搜索筛选下拉（源 el-select filterable → 搜索输入 + 选项列表）。
 * Props 与 FormSelect 对齐，Controller 接 RHF；「全部」哨兵恒置顶不参与过滤，
 * 其余按 label 子串过滤（Element Plus filterable 默认行为）。
 */
function FilterableFormSelect<TFieldValues extends FieldValues = FieldValues>({
  name,
  control,
  label,
  options,
  placeholder = 'All',
}: {
  name: Path<TFieldValues>;
  control: Control<TFieldValues>;
  label: string;
  options: SelectOption[];
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const needle = q.trim().toLowerCase();
  const filtered = options.filter(
    (o) =>
      o.value === OPT_ALL || !needle || o.label.toLowerCase().includes(needle),
  );
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Popover
            open={open}
            onOpenChange={(next) => {
              // 每次展开重置搜索词（源 filterable 打开即输入）。
              if (next) setQ('');
              setOpen(next);
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between font-normal"
              >
                <span className="truncate">
                  {options.find((o) => o.value === field.value)?.label ??
                    placeholder}
                </span>
                <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-[var(--radix-popover-trigger-width)] p-0"
            >
              <div className="border-b p-2">
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Type keyword to filter"
                  className="h-8"
                />
              </div>
              <ScrollArea className="h-48">
                <div className="p-1">
                  {filtered.length === 0 ? (
                    <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                      No matches
                    </p>
                  ) : (
                    filtered.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          field.onChange(opt.value);
                          setOpen(false);
                        }}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent',
                          opt.value === field.value && 'font-medium text-primary',
                        )}
                      >
                        <span className="truncate">{opt.label}</span>
                        {opt.value === field.value && (
                          <Check className="size-4 shrink-0" aria-hidden="true" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        )}
      />
    </div>
  );
}

/** Select 的「全部」哨兵值（Radix SelectItem 不宜用空串，故用哨兵）。 */
const OPT_ALL = '__all__';

/* ================================================================== */
/* 异常处置 Dialog（源 resolve-dialog.vue）                             */
/* ================================================================== */

const RESOLVE_ACTION_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '1', label: 'Complete' },
  { value: '2', label: 'Failed' },
  { value: '3', label: 'Reversal Completed' },
];

/** 成功提示按 action 区分（源 RESOLVE_SUCCESS_MSG）。 */
const RESOLVE_SUCCESS_MSG: Record<string, string> = {
  1: 'Transaction marked as completed',
  2: 'Transaction marked as failed',
  3: 'Reversal resolution completed',
};

/**
 * 交易异常处置弹窗。入口仅 EXCEPTION(70) 行可见（与后端「仅 70 可裁定」一致）。
 * action 1 完成 / 2 失败 / 3 冲正完成（设计 S2 口径三行提示照迁）。
 */
function ResolveDialog({
  row,
  open,
  onOpenChange,
}: {
  row: TransactionRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const toast = useToast();
  const mutation = useResolveTransactionMutation(KISSEN_PROJECT_ID);
  // 用户扣款按源 token 精度展示（4609208）。
  const { decimalsOf: decOf } = useTokenMeta(KISSEN_PROJECT_ID);
  const [action, setAction] = React.useState('');
  const [reason, setReason] = React.useState('');

  // 每次打开重置表单（与源 reactive form 一致）。
  React.useEffect(() => {
    if (open) {
      setAction('');
      setReason('');
    }
  }, [open]);

  const submitting = mutation.isPending;

  const onSubmit = () => {
    if (!row || !action) return;
    mutation.mutate(
      {
        txId: row.transactionId,
        action: Number(action) as 1 | 2 | 3,
        reason: reason.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(RESOLVE_SUCCESS_MSG[action] ?? 'Resolved successfully');
          onOpenChange(false);
        },
        onError: (err: unknown) => toast.error((err as Error).message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[560px]"
        // 源 :close-on-click-modal="false"：点击遮罩不关闭。
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Transaction Exception Resolution</DialogTitle>
          <DialogDescription>
            Only transactions in Exception status can be resolved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 概要：与源 el-descriptions 一致 */}
          <div className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-md border p-3 text-sm sm:grid-cols-2">
            <DescField label="Transaction No.">{orDash(row?.txNo)}</DescField>
            <DescField label="Transaction ID">{row?.transactionId ?? '-'}</DescField>
            <DescField label="Currency Pair">
              {row ? pairText(row.sourceCurrency, row.targetCurrency) : '-'}
            </DescField>
            <DescField label="User Deduction">
              {row
                ? fmtAmount(
                    row.userDeduction,
                    row.sourceCurrency || undefined,
                    decOf(row.sourceCurrency),
                  )
                : '-'}
            </DescField>
          </div>

          {/* 处置方式（源 el-radio-group 必填） */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Resolution<span className="ml-0.5 text-destructive">*</span>
            </label>
            <RadioGroup value={action} onValueChange={setAction}>
              {RESOLVE_ACTION_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className="flex items-center gap-2 text-sm"
                >
                  <RadioGroupItem value={o.value} /> {o.label}
                </label>
              ))}
            </RadioGroup>
            {/* §6.4：必选说明（判定不变，Submit 仍以 disabled 兜底）。 */}
            <p className="text-xs text-muted-foreground">
              Select a resolution option before submitting.
            </p>
            {/* 口径提示三行（源 .form-tip） */}
            <p className="text-xs leading-relaxed text-muted-foreground">
              Complete: backfill the settlement record and send the final-state notification; the transaction moves to Completed
              <br />
              Failed: the transaction moves to Failed and the failure reason is recorded
              <br />
              Reversal Completed: create or complete the reversal order; the transaction moves to Reversed
            </p>
          </div>

          {/* 裁定原因（选填 maxlength 200 带字数，入 flow 留痕） */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Resolution Reason</label>
            <Textarea
              rows={3}
              maxLength={200}
              placeholder="Optional, recorded in the flow log"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex justify-end">
              <span className="text-muted-foreground text-xs">
                {reason.length}/200
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!action || submitting}>
            {submitting ? 'Submitting…' : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 详情异常提示（真实 failReason 载体；置于两栏网格之前）。 */
function TransactionStatusAlert({ detail }: { detail: TransactionDetailRow }) {
  if (detail.status !== 90 && detail.status !== 70 && detail.status !== 50) {
    return null;
  }

  return (
    <Alert
      variant={detail.status === 50 ? 'warning' : 'destructive'}
      className="mb-0"
    >
      <AlertTitle>
        {detail.status === 90
          ? 'Transaction failed'
          : detail.status === 70
            ? 'Transaction exception — manual handling required'
            : 'Reversal in progress'}
      </AlertTitle>
      {detail.failReason ? (
        <AlertDescription>{detail.failReason}</AlertDescription>
      ) : null}
    </Alert>
  );
}

/* ================================================================== */
/* 详情独立页（原型 FxTransactionDetailsPage：左 8 / 右 4 两栏）         */
/* ================================================================== */

/** 详情字段（label 小字灰 + 值一行；空值统一 Dash）。 */
function TxDetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium capitalize text-muted-foreground">
        {label}
      </label>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

/** 详情卡分区头（图标方帖 + 标题；右可挂 aside，如耗时徽章）。 */
function TxSectionHeader({
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

/** 交易详情 not-found 卡（原型 EmptyState 同文案）。 */
function TxNotFoundCard() {
  const router = useRouter();
  return (
    <div className="rounded-lg border border-border/60 bg-card p-8 text-center">
      <p className="text-sm font-medium text-foreground">Transaction not found.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        The record may have been removed.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={() => router.push(TX_LIST_PATH)}
      >
        Back to FX Transactions
      </Button>
    </div>
  );
}

/**
 * 交易详情独立页（/transfer/tx/detail?id=）：加载交易详情。
 * 左 8/12 = Settlement Overview / Transaction Information / Timing；
 * 右 4/12 = Clearance Pipeline（7 节点干线）。
 */
export function TxDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawId = searchParams.get('id');
  const txId = Number(rawId);
  const hasId =
    rawId !== null && rawId !== '' && Number.isInteger(txId) && txId > 0;

  // hasId 为假时传 undefined：query 层 enabled 门禁不发起请求。
  const detailQuery = useTransactionDetailQuery(
    KISSEN_PROJECT_ID,
    hasId ? txId : undefined,
  );
  // 金额按源/目标 token 精度（4609208）。
  const { decimalsOf: decOf } = useTokenMeta(KISSEN_PROJECT_ID);

  // R1：Copy Summary 反馈（copied 绿 ✓ / error 红，1.6s 复位）。
  const [copyState, setCopyState] = React.useState<'idle' | 'copied' | 'error'>(
    'idle',
  );
  const copyResetTimer = React.useRef<number | undefined>(undefined);
  React.useEffect(
    () => () => {
      clearTimeout(copyResetTimer.current);
    },
    [],
  );

  const detail = detailQuery.data;
  const loading = detailQuery.isLoading && !detail;
  const notFound = !hasId || (!loading && !detailQuery.isError && !detail);

  const handleCopySummary = React.useCallback(() => {
    if (!detail) return;
    const source = detail.sourceCurrency || '-';
    const target = detail.targetCurrency || '-';
    const summary = [
      `Transaction ID: ${detail.txNo || detail.txUuid}`,
      `Status: ${protoStatusLabel(PROTO_TX_STATUS, detail.status)}`,
      `Token Pair: ${source}/${target}`,
      `Sold Amount: ${fmtAmount(detail.userDeduction, source, decOf(source))}`,
      `Credited Amount: ${fmtAmount(detail.receiverAmount, target, decOf(target))}`,
      `FX Rate: 1 ${source} ≈ ${formatRate(detail.userRate)} ${target}`,
      `LP: ${detail.lpName || '-'}`,
      `Created: ${formatUtc8(detail.createTime)}`,
      detail.completedTime > 0
        ? `Settled: ${formatUtc8(detail.completedTime)}`
        : 'Completed: -',
    ].join('\n');
    navigator.clipboard
      .writeText(summary)
      .then(() => setCopyState('copied'))
      .catch(() => setCopyState('error'));
    clearTimeout(copyResetTimer.current);
    copyResetTimer.current = window.setTimeout(
      () => setCopyState('idle'),
      1600,
    );
  }, [decOf, detail]);

  // R4：管线推进位（分支态取 fork 位）。
  const currentIndex = detail ? pipelineIndexOf(detail.status) : -1;
  const pipelineStates = React.useMemo<PipelineState[] | null>(() => {
    if (!detail) return null;
    return PIPELINE_STEP_NAMES.map((_, index) =>
      pipelineStateOf(detail.status, index, currentIndex),
    );
  }, [currentIndex, detail]);
  const finalizedCount =
    pipelineStates?.filter((s) => s === 'done').length ?? 0;
  const progressPct = (finalizedCount / PIPELINE_STEP_NAMES.length) * 100;
  const latencyMs =
    detail && detail.completedTime > 0
      ? detail.completedTime - detail.createTime
      : null;

  return (
    <div className="space-y-4">
      {/* 页头（原型 V1）：Back + 标题 + 状态徽章 + 元信息行 + Copy Summary。 */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-start gap-3">
          <Button
            variant="outline"
            size="iconSm"
            aria-label="Back to FX transactions"
            onClick={() => router.push(TX_LIST_PATH)}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold">Transaction Details</h1>
              {detail ? (
                <ProtoStatusBadge tone={TX_STATUS_TONE[detail.status] ?? 'muted'}>
                  {protoStatusLabel(PROTO_TX_STATUS, detail.status)}
                </ProtoStatusBadge>
              ) : null}
            </div>
            {detail ? (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  Transaction No:{' '}
                  <span className="font-semibold text-foreground">
                    <CopyableId value={detail.txNo || detail.txUuid} />
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
        {detail ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={handleCopySummary}
          >
            {copyState === 'copied' ? (
              <Check className="size-3.5 text-success" aria-hidden="true" />
            ) : (
              <Copy className="size-3.5" aria-hidden="true" />
            )}
            {copyState === 'copied'
              ? 'Copied'
              : copyState === 'error'
                ? 'Copy unavailable'
                : 'Copy Summary'}
          </Button>
        ) : null}
      </div>

      {detailQuery.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Failed to load transaction.</AlertTitle>
        </Alert>
      ) : null}

      {notFound ? <TxNotFoundCard /> : null}

      {loading ? (
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
          <div className="space-y-4 xl:col-span-8">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
          <Skeleton className="h-96 w-full rounded-xl xl:col-span-4" />
        </div>
      ) : null}

      {detail && pipelineStates ? (
        <>
          {/* 异常/冲正提示（真实 failReason 载体，置于两栏网格之前）。 */}
          <TransactionStatusAlert detail={detail} />

          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
            {/* 左 8/12 */}
            <div className="flex min-w-0 flex-col gap-4 xl:col-span-8">
              {/* R1'：Settlement Overview（Sent/Received 左右 + 中间汇率与 LP）。 */}
              <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <TxSectionHeader
                  icon={ArrowLeftRight}
                  title="Settlement Overview"
                  aside={
                    latencyMs != null ? (
                      <Badge variant="success" dot>
                        Settled in {formatDuration(latencyMs)}
                      </Badge>
                    ) : undefined
                  }
                />
                <div className="p-6">
                  <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
                    <div className="min-w-0 rounded-lg border border-border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Sent Amount
                        </span>
                        <Badge variant="mute">
                          {detail.sourceBankName || 'Source Bank'}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5">
                        <span className="text-2xl font-bold tabular-nums">
                          {formatTokenAmount(
                            detail.userDeduction,
                            decOf(detail.sourceCurrency),
                          )}
                        </span>
                        {detail.sourceCurrency ? (
                          <span className="text-sm font-semibold tracking-wide">
                            {detail.sourceCurrency}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex min-w-0 shrink-0 flex-col items-center gap-2 md:px-6">
                      <Badge variant="outline" className="whitespace-nowrap tabular-nums">
                        1 {detail.sourceCurrency || '-'} ≈{' '}
                        {formatRate(detail.userRate)}{' '}
                        {detail.targetCurrency || '-'}
                      </Badge>
                      <Repeat
                        aria-hidden="true"
                        className="size-4 text-primary"
                      />
                      <Badge className="max-w-full truncate whitespace-nowrap">
                        {detail.lpName || '-'}
                      </Badge>
                    </div>
                    <div className="min-w-0 rounded-lg border border-success bg-success/10 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Received Amount
                        </span>
                        <Badge variant="mute">
                          {detail.targetBankName || 'Target Bank'}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5 text-success">
                        <span className="text-2xl font-bold tabular-nums">
                          +
                          {formatTokenAmount(
                            detail.receiverAmount,
                            decOf(detail.targetCurrency),
                          )}
                        </span>
                        {detail.targetCurrency ? (
                          <span className="text-sm font-semibold tracking-wide">
                            {detail.targetCurrency}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-3">
                    <TxDetailField label="LP Name">
                      {orDash(detail.lpName)}
                    </TxDetailField>
                    <TxDetailField label="Token Pair">
                      {detail.sourceCurrency && detail.targetCurrency
                        ? `${detail.sourceCurrency}/${detail.targetCurrency}`
                        : '-'}
                    </TxDetailField>
                    <TxDetailField label="Quote Version & SLA">
                      <span className="inline-flex flex-wrap items-center gap-2">
                        <span className="font-mono tabular-nums">
                          v{detail.quoteVersion}
                        </span>
                        {/* STATIC-FILLER(GAP-ADM-08): SLA 徽章为原型演示口径，后端无 SLA 字段。 */}
                        <Badge variant="success">60s Guaranteed Lock</Badge>
                      </span>
                    </TxDetailField>
                  </dl>
                </div>
              </section>

              {/* R2'：Transaction Information（两列成对字段）。 */}
              <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <TxSectionHeader icon={FileText} title="Transaction Information" />
                <div className="grid grid-cols-1 gap-x-6 gap-y-5 p-6 md:grid-cols-2">
                  <TxDetailField label="Transaction ID">
                    <span className="font-mono tabular-nums">
                      {detail.transactionId}
                    </span>
                  </TxDetailField>
                  <TxDetailField label="Sender Bank">
                    {orDash(detail.sourceBankName)}
                  </TxDetailField>
                  <TxDetailField label="Receiver Bank">
                    {orDash(detail.targetBankName)}
                  </TxDetailField>
                  <TxDetailField label="Sender Wallet">
                    <CopyableId value={detail.senderAccount} />
                  </TxDetailField>
                  <TxDetailField label="Receiver Wallet">
                    <CopyableId value={detail.receiverAccount} />
                  </TxDetailField>
                  <TxDetailField label="Principal">
                    <span className="font-mono tabular-nums">
                      {fmtAmount(
                        detail.principal,
                        detail.sourceCurrency || undefined,
                        decOf(detail.sourceCurrency),
                      )}
                    </span>
                  </TxDetailField>
                  <TxDetailField label="User Deduction">
                    <span className="font-mono tabular-nums">
                      {fmtAmount(
                        detail.userDeduction,
                        detail.sourceCurrency || undefined,
                        decOf(detail.sourceCurrency),
                      )}
                    </span>
                  </TxDetailField>
                  {/* 本仓补位：备注为真实字段（原型未展示，长文本跨列）。 */}
                  <TxDetailField label="Remarks">
                    {orDash(detail.remark)}
                  </TxDetailField>
                </div>
              </section>

              {/* V3：Timing。 */}
              <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <TxSectionHeader icon={Clock3} title="Timing" />
                <div className="grid grid-cols-1 gap-x-6 gap-y-5 p-6 md:grid-cols-3">
                  <TxDetailField label="Created on">
                    <span className="tabular-nums">
                      {formatUtc8(detail.createTime)}
                    </span>
                  </TxDetailField>
                  <TxDetailField label="Completed on">
                    <span className="tabular-nums">
                      {detail.completedTime > 0 ? (
                        formatUtc8(detail.completedTime)
                      ) : (
                        <Dash />
                      )}
                    </span>
                  </TxDetailField>
                  <TxDetailField label="Duration">
                    <span className="tabular-nums">
                      {latencyMs != null ? formatDuration(latencyMs) : <Dash />}
                    </span>
                  </TxDetailField>
                </div>
              </section>
            </div>

            {/* 右 4/12：Clearance Pipeline。 */}
            <div className="flex min-w-0 flex-col gap-4 xl:col-span-4">
              <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <header className="border-b border-border px-6 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                          <Workflow className="size-4" aria-hidden="true" />
                        </span>
                        <h2 className="text-sm font-semibold text-foreground">
                          Clearance Pipeline
                        </h2>
                        <Badge variant="success" className="tabular-nums">
                          {finalizedCount}/{PIPELINE_STEP_NAMES.length} Finalized
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Real-time multi-agent state clearance
                      </p>
                    </div>
                    <span className="text-lg font-bold tabular-nums text-success">
                      {formatPercent(Math.round(progressPct))}
                    </span>
                  </div>
                </header>
                <div className="p-6">
                  <div
                    role="progressbar"
                    aria-label="Clearance progress"
                    aria-valuemin={0}
                    aria-valuemax={PIPELINE_STEP_NAMES.length}
                    aria-valuenow={finalizedCount}
                  >
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          finalizedCount === PIPELINE_STEP_NAMES.length
                            ? 'bg-success'
                            : 'bg-primary',
                        )}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                  {/* 垂直时间线：size-8 节点圆（完成=实心绿+白勾 / 异常=红+X /
                      推进中=黄实心 / 终态=灰 / 未到=空心）+ 每步 Tooltip。 */}
                  <ol className="mt-6">
                    {PIPELINE_STEP_NAMES.map((step, index) => {
                      const state = pipelineStates[index];
                      const info = RAIL_STEP_INFO[step];
                      const stateText =
                        STEP_STATE_TEXT[state] ?? {
                          text: protoStatusLabel(PROTO_TX_STATUS, detail.status),
                          className:
                            state === 'danger'
                              ? 'text-destructive'
                              : 'text-muted-foreground',
                        };
                      const finalizedStep =
                        step === 'Completed' && state === 'done';
                      // D18：Created/Completed 两步显示完整时刻（真实时间戳）；
                      // 其余非 future 步显示相对耗时 +{deltaSec}s（见 GAP-ADM-08）。
                      const absoluteTime =
                        step === 'Created'
                          ? formatUtc8(detail.createTime)
                          : step === 'Completed' && detail.completedTime > 0
                            ? formatUtc8(detail.completedTime)
                            : '';
                      const rightTime =
                        absoluteTime ||
                        (state !== 'future' ? `+${info.deltaSec}s` : '');
                      return (
                        <li
                          key={step}
                          aria-current={
                            index === currentIndex ? 'step' : undefined
                          }
                          className="relative min-w-0 pb-6 pl-12 last:pb-0"
                        >
                          {index < PIPELINE_STEP_NAMES.length - 1 ? (
                            <span
                              aria-hidden="true"
                              className="absolute bottom-0 left-[15px] top-8 w-px bg-border"
                            />
                          ) : null}
                          <span
                            aria-hidden="true"
                            className={cn(
                              'absolute left-0 top-0 grid size-8 place-items-center rounded-full',
                              NODE_STYLES[state],
                            )}
                          >
                            {state === 'done' ? (
                              <Check className="size-4 text-white" />
                            ) : null}
                            {state === 'danger' ? (
                              <X className="size-4 text-white" />
                            ) : null}
                            {state === 'warning' ? (
                              <span className="size-2 rounded-full bg-white" />
                            ) : null}
                          </span>
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="cursor-help">
                                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                        {String(index + 1).padStart(2, '0')}
                                      </span>
                                      <span
                                        className={cn(
                                          'text-sm font-semibold',
                                          state === 'future'
                                            ? 'text-muted-foreground'
                                            : 'text-foreground',
                                        )}
                                      >
                                        {step}
                                      </span>
                                      {finalizedStep ? (
                                        <Badge variant="success">Finalized</Badge>
                                      ) : (
                                        <span
                                          className={cn(
                                            'text-xs',
                                            stateText.className,
                                          )}
                                        >
                                          {stateText.text}
                                        </span>
                                      )}
                                    </div>
                                    {rightTime ? (
                                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                        {rightTime}
                                      </span>
                                    ) : null}
                                  </div>
                                  <p
                                    className={cn(
                                      'mt-1 text-xs',
                                      state === 'future'
                                        ? 'text-muted-foreground'
                                        : 'text-muted-foreground',
                                    )}
                                  >
                                    {info.description}
                                  </p>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div>
                                  <div>{info.description}</div>
                                  <div className="mt-1 text-muted-foreground">
                                    Operator:{' '}
                                    <span className="font-medium text-foreground">
                                      {info.operator}
                                    </span>
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </section>

            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ================================================================== */
/* 列表页核心（原型 FxTransactionsPage：7 平铺筛选 + 全列可排序）        */
/* ================================================================== */

interface TxFilterForm {
  txNo: string;
  status: string;
  lpId: string;
  pairId: string;
  sourceBankId: string;
  targetBankId: string;
  createdFrom: string;
  createdTo: string;
}

function defaultFilterForm(): TxFilterForm {
  return {
    txNo: '',
    status: OPT_ALL,
    lpId: OPT_ALL,
    pairId: OPT_ALL,
    sourceBankId: OPT_ALL,
    targetBankId: OPT_ALL,
    createdFrom: '',
    createdTo: '',
  };
}

/** 毫秒时间戳 → 本地 YYYY-MM-DD（date input 值）。 */
function toDateInput(value: string | null): string {
  const ms = Number(value);
  if (!value || !Number.isFinite(ms)) return '';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * 深链筛选回填：dashboard Pending Exceptions「?transactionNo=」「?status=Exception」
 * （label 或数字码）；结算单详情跳转带「?lpId=&createTimeStart=」（毫秒）。
 */
function filterFormFromSearchParams(searchParams: {
  get: (name: string) => string | null;
}): TxFilterForm {
  const form = defaultFilterForm();
  const transactionNo = searchParams.get('transactionNo');
  if (transactionNo) form.txNo = transactionNo;
  const lpId = searchParams.get('lpId');
  if (lpId && Number.isInteger(Number(lpId)) && Number(lpId) > 0) {
    form.lpId = lpId;
  }
  const statusParam = searchParams.get('status');
  if (statusParam) {
    if (/^\d+$/.test(statusParam) && PROTO_TX_STATUS[Number(statusParam)]) {
      form.status = statusParam;
    } else {
      const hit = Object.entries(PROTO_TX_STATUS).find(
        ([, meta]) => meta.label.toLowerCase() === statusParam.toLowerCase(),
      );
      if (hit) form.status = hit[0];
    }
  }
  form.createdFrom = toDateInput(searchParams.get('createTimeStart'));
  return form;
}

/** RHF 筛选表单 → 后端 TransactionPageFilter；空/哨兵字段剔除。
 *  日期半开区间：From 当日 0 点起、To 次日 0 点止（含 To 全天）。 */
function formToFilter(form: TxFilterForm): TransactionPageFilter {
  const f: TransactionPageFilter = {};
  const txNo = form.txNo.trim();
  if (txNo) f.txNo = txNo;
  if (form.status && form.status !== OPT_ALL) f.status = Number(form.status);
  if (form.lpId !== OPT_ALL) f.lpId = Number(form.lpId);
  if (form.pairId !== OPT_ALL) f.pairId = Number(form.pairId);
  if (form.sourceBankId !== OPT_ALL) f.sourceBankId = Number(form.sourceBankId);
  if (form.targetBankId !== OPT_ALL) f.targetBankId = Number(form.targetBankId);
  if (form.createdFrom) {
    const start = new Date(`${form.createdFrom}T00:00:00`).getTime();
    if (Number.isFinite(start)) f.createTimeStart = start;
  }
  if (form.createdTo) {
    const end = new Date(`${form.createdTo}T00:00:00`);
    if (!Number.isNaN(end.getTime())) {
      end.setDate(end.getDate() + 1);
      f.createTimeEnd = end.getTime();
    }
  }
  return f;
}

const PAGE_SIZE_DEFAULT = 10;

function TransactionListCore() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // From/To 金额按源/目标 token 精度展示（4609208）。
  const { decimalsOf: decOf } = useTokenMeta(KISSEN_PROJECT_ID);
  const initialFilterForm = React.useMemo(
    () => filterFormFromSearchParams(searchParams),
    [searchParams],
  );
  const { register, handleSubmit, reset, control } = useForm<TxFilterForm>({
    defaultValues: initialFilterForm,
  });

  const [filter, setFilter] = React.useState<TransactionPageFilter>(() =>
    formToFilter(initialFilterForm),
  );
  const [pageNum, setPageNum] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);
  const [resolveRow, setResolveRow] = React.useState<TransactionRow | null>(null);
  const [resolveOpen, setResolveOpen] = React.useState(false);

  const { data, isLoading, isError, dataUpdatedAt } = useTransactionListQuery(KISSEN_PROJECT_ID, {
    pageNum,
    pageSize,
    filter,
  });
  // 下拉四组并行拉取（LP/交易对/银行；pairOptionById 另做 Tokens 列回显）。
  const { data: lpOptions } = useTransactionLpOptionsQuery(KISSEN_PROJECT_ID);
  const { data: pairOptions } = useTransactionPairOptionsQuery(KISSEN_PROJECT_ID);
  const { data: bankOptions } = useTransactionBankOptionsQuery(KISSEN_PROJECT_ID);

  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;
  const pairOptionById = React.useMemo(
    () => new Map((pairOptions ?? []).map((option) => [option.pairId, option])),
    [pairOptions],
  );

  const onSubmit = React.useCallback((form: TxFilterForm) => {
    // 查询回第 1 页（源 onSearch）。
    setFilter(formToFilter(form));
    setPageNum(1);
  }, []);

  const onReset = React.useCallback(() => {
    const fresh = defaultFilterForm();
    reset(fresh);
    setFilter(formToFilter(fresh));
    setPageNum(1);
  }, [reset]);

  const openResolve = React.useCallback((row: TransactionRow) => {
    setResolveRow(row);
    setResolveOpen(true);
  }, []);

  // 排序取值器（当前数据集内本地排序；Tokens/From/To 不可排序，同原型）。
  const sortGetters = React.useMemo<
    Record<string, ProtoSortGetter<TransactionRow>>
  >(
    () => ({
      transactionNo: {
        value: (r) => r.txNo || r.txUuid,
      },
      fxRate: {
        value: (r) => {
          const n = Number(r.userRate);
          return Number.isFinite(n) ? n : null;
        },
      },
      lpName: { value: (r) => r.lpName },
      status: { value: (r) => protoStatusRank(PROTO_TX_STATUS, r.status) },
      createdOn: { value: (r) => r.createTime, defaultDir: 'desc' },
      completedOn: {
        value: (r) => (r.completedTime > 0 ? r.completedTime : null),
        defaultDir: 'desc',
      },
    }),
    [],
  );
  const { sorted, toggle, sortState } = useProtoSort(
    rows,
    sortGetters,
    'createdOn',
    'desc',
  );

  const columns = React.useMemo<
    ColumnDef<TransactionRow & { id: string }>[]
  >(
    () => [
      {
        id: 'transactionNo',
        header: () => (
          <ProtoSortHeader
            label="Transaction No."
            columnKey="transactionNo"
            toggle={toggle}
            sortState={sortState("transactionNo")}
          />
        ),
        meta: { maxWidth: 230 },
        cell: ({ row }) => (
          <CopyableId value={row.original.txNo || row.original.txUuid} />
        ),
      },
      {
        id: 'tokens',
        header: 'Tokens',
        meta: { overflow: 'wrap', maxWidth: 220 },
        cell: ({ row }) => {
          const r = row.original;
          const pair = pairOptionById.get(r.pairId);
          const banks = `${r.sourceBankName || '-'} → ${r.targetBankName || '-'}`;
          const sourceToken =
            pair?.sourceSymbol || pair?.sourceTokenCode || r.sourceCurrency;
          const targetToken =
            pair?.targetSymbol || pair?.targetTokenCode || r.targetCurrency;
          return (
            <div className="flex min-w-0 flex-col leading-snug">
              <span className="font-mono text-[13px] font-semibold">
                {sourceToken || '-'}/{targetToken || '-'}
              </span>
              <span className="truncate text-xs text-muted-foreground" title={banks}>
                {banks}
              </span>
            </div>
          );
        },
      },
      {
        id: 'from',
        header: 'From',
        meta: { overflow: 'wrap', maxWidth: 220 },
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex min-w-0 flex-col gap-0.5 leading-snug">
              <span className="font-bold tabular-nums">
                {fmtAmount(
                  r.userDeduction,
                  r.sourceCurrency || undefined,
                  decOf(r.sourceCurrency),
                )}
              </span>
              <CopyableId
                value={r.senderAccount}
                className="max-w-[190px]"
              />
            </div>
          );
        },
      },
      {
        id: 'to',
        header: 'To',
        meta: { overflow: 'wrap', maxWidth: 220 },
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex min-w-0 flex-col gap-0.5 leading-snug">
              <span className="font-bold tabular-nums">
                {fmtAmount(
                  r.receiverAmount,
                  r.targetCurrency || undefined,
                  decOf(r.targetCurrency),
                )}
              </span>
              <CopyableId
                value={r.receiverAccount}
                className="max-w-[190px]"
              />
            </div>
          );
        },
      },
      {
        id: 'fxRate',
        header: () => (
          <div className="flex justify-end">
            <ProtoSortHeader
              label="FX Rate"
              columnKey="fxRate"
              toggle={toggle}
              sortState={sortState("fxRate")}
            />
          </div>
        ),
        meta: { overflow: 'none' },
        cell: ({ row }) => (
          <div className="flex justify-end">
            <span className="font-mono tabular-nums">
              {formatRate(row.original.userRate)}
            </span>
          </div>
        ),
      },
      {
        id: 'lpName',
        header: () => (
          <ProtoSortHeader
            label="LP Name"
            columnKey="lpName"
            toggle={toggle}
            sortState={sortState("lpName")}
          />
        ),
        meta: { maxWidth: 150 },
        cell: ({ row }) => (
          <span
            className="block max-w-[140px] truncate"
            title={row.original.lpName}
          >
            {row.original.lpName || '-'}
          </span>
        ),
      },
      {
        id: 'status',
        header: () => (
          <ProtoSortHeader
            label="Status"
            columnKey="status"
            toggle={toggle}
            sortState={sortState("status")}
          />
        ),
        cell: ({ row }) => (
          <ProtoStatusBadge
            tone={TX_STATUS_TONE[row.original.status] ?? 'muted'}
          >
            {protoStatusLabel(PROTO_TX_STATUS, row.original.status)}
          </ProtoStatusBadge>
        ),
      },
      {
        id: 'createdOn',
        header: () => (
          <ProtoSortHeader
            label="Created on"
            columnKey="createdOn"
            toggle={toggle}
            sortState={sortState("createdOn")}
          />
        ),
        meta: { maxWidth: 220 },
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatUtc8(row.original.createTime)}
          </span>
        ),
      },
      {
        id: 'completedOn',
        header: () => (
          <ProtoSortHeader
            label="Completed on"
            columnKey="completedOn"
            toggle={toggle}
            sortState={sortState("completedOn")}
          />
        ),
        meta: { maxWidth: 220 },
        cell: ({ row }) => {
          // GAP-ADM-03 已闭环：completedTime 为真实字段（0=未完成 → Dash）。
          return row.original.completedTime > 0 ? (
            <span className="tabular-nums">
              {formatUtc8(row.original.completedTime)}
            </span>
          ) : (
            <Dash />
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex items-center">
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() =>
                  router.push(`${TX_LIST_PATH}/detail?id=${r.transactionId}`)
                }
              >
                Details
              </Button>
              {/* D7：Resolve 仅 EXCEPTION(70) 行（后端「仅 70 可裁定」UI 投影）。 */}
              {r.status === 70 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="iconSm"
                      className="ml-2"
                      aria-label="More actions"
                    >
                      <MoreVertical className="size-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive"
                      onSelect={() => openResolve(r)}
                    >
                      Resolve
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          );
        },
      },
    ],
    [decOf, openResolve, pairOptionById, router, sortState, toggle],
  );

  const tableData = React.useMemo(
    () => sorted.map((r) => ({ ...r, id: String(r.transactionId) })),
    [sorted],
  );

  // 下拉选项（首项「全部」哨兵；LP/银行 pageSize=200 截断口径在 data-access）。
  const lpSelectOptions = React.useMemo(
    () => [
      { value: OPT_ALL, label: 'All' },
      ...(lpOptions ?? []).map((l) => ({
        value: String(l.lpId),
        label: `${l.lpName}(${l.lpCode})`,
      })),
    ],
    [lpOptions],
  );
  const pairSelectOptions = React.useMemo(
    () => [
      { value: OPT_ALL, label: 'All' },
      ...(pairOptions ?? []).map((p) => ({
        value: String(p.pairId),
        label: `${p.sourceSymbol || p.sourceTokenCode}→${p.targetSymbol || p.targetTokenCode}`,
      })),
    ],
    [pairOptions],
  );
  const bankSelectOptions = React.useMemo(
    () => [
      { value: OPT_ALL, label: 'All' },
      ...(bankOptions ?? []).map((b) => ({
        value: String(b.bankId),
        label: b.bankName,
      })),
    ],
    [bankOptions],
  );
  const statusSelectOptions = React.useMemo(
    () => [{ value: OPT_ALL, label: 'All' }, ...TX_STATUS_OPTIONS],
    [],
  );

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              FX Transactions
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
          onSubmit={handleSubmit(onSubmit)}
          className="border-b border-border/50 px-4 py-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              name="txNo"
              label="Transaction No."
              placeholder="Exact match"
              maxLength={32}
              register={register('txNo')}
            />
            <FilterableFormSelect
              name="pairId"
              control={control}
              label="Token Pair"
              options={pairSelectOptions}
              placeholder="All"
            />
            <FilterableFormSelect
              name="lpId"
              control={control}
              label="LP Name"
              options={lpSelectOptions}
              placeholder="All"
            />
            <FormSelect
              name="status"
              control={control}
              label="Status"
              options={statusSelectOptions}
              placeholder="All"
            />
            {/* 时间区间（原型单 DateRangeField）：双 date 输入 From/To。 */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium leading-snug text-foreground">
                Creation Date
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  aria-label="Creation date from"
                  {...register('createdFrom')}
                />
                <Input
                  type="date"
                  aria-label="Creation date to"
                  {...register('createdTo')}
                />
              </div>
            </div>
            <FilterableFormSelect
              name="sourceBankId"
              control={control}
              label="Source Bank"
              options={bankSelectOptions}
              placeholder="All"
            />
            <FilterableFormSelect
              name="targetBankId"
              control={control}
              label="Target Bank"
              options={bankSelectOptions}
              placeholder="All"
            />
            <div className="flex flex-wrap items-end gap-2">
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
              emptyMessage="No transactions found."
              pagination={
                paginationMeta
                  ? {
                      page: paginationMeta.page,
                      pageSize: paginationMeta.pageSize,
                      total: paginationMeta.total,
                      onPageChange: setPageNum,
                      onPageSizeChange: (n) => {
                        // 源 @size-change="onSearch"：切换条数即回第 1 页重查。
                        setPageSize(n);
                        setPageNum(1);
                      },
                    }
                  : undefined
              }
            />
          )}
        </div>
      </section>

      <ResolveDialog
        row={resolveRow}
        open={resolveOpen}
        onOpenChange={setResolveOpen}
      />
    </div>
  );
}

/* ================================================================== */
/* 导出页（registry 依赖，名字不可改）                                  */
/* ================================================================== */

/** 交易查询列表（全状态单页；/transfer/tx）。 */
export function TxListListPage() {
  return <TransactionListCore />;
}
