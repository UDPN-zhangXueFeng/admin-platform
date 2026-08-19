'use client';

import * as React from 'react';
import {
  Controller,
  useForm,
  type Control,
  type FieldValues,
  type Path,
} from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { Check, ChevronsUpDown } from 'lucide-react';

import {
  Badge,
  Button,
  createActionColumn,
  DataTable,
  type TableRowAction,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RadioGroup,
  RadioGroupItem,
  ScrollArea,
  Skeleton,
  Textarea,
  useToast,
} from '@myorg/shared/ui';
import { FormField, FormSelect, type SelectOption } from '@myorg/shared/ui-forms';
import { cn } from '@myorg/shared/util-classnames';
import { formatAdminDateTime } from '@myorg/shared/util-dates';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  KISSEN_PROJECT_ID,
  TRANSACTION_STATUS_LABEL,
  TRANSACTION_STATUS_VARIANT,
  TX_STATUS_OPTIONS,
  useResolveTransactionMutation,
  useTransactionBankOptionsQuery,
  useTransactionChainQuery,
  useTransactionDetailQuery,
  useTransactionListQuery,
  useTransactionLpOptionsQuery,
  useTransactionPairOptionsQuery,
  type TransactionDetailRow,
  type TransactionFlowEvent,
  type TransactionPageFilter,
  type TransactionRow,
  type TransactionStage,
} from '@myorg/modules/kissen-admin/data-access';

/**
 * 交易域页面（源 `views/transfer/tx/**`：index / resolve-dialog / tx-detail-drawer）。
 *
 * 导出（registry 依赖，名字不可改）：
 *  - TxListListPage / TxListDetailPage      交易查询（全状态）
 *  - TxExceptionListPage / TxExceptionDetailPage  异常处理（status=70 过滤视图）
 *  - TxReversalListPage                     冲正记录（status 50/60 过滤视图，源无独立页）
 *
 * 文案采用中文硬编码兜底（message key 未就绪，避免 MISSING_MESSAGE 崩溃）。
 */

/* ================================================================== */
/* 展示工具（移植源 views/approval/format.ts 的 formatMoney/formatTime）*/
/* ================================================================== */

/** 数字千分位（保留原小数位）；空/0/非数 → '-'。 */
function formatMoney(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '-';
  const s = String(v);
  const [int, dec] = s.split('.');
  const sign = int.startsWith('-') ? '-' : '';
  const digits = sign ? int.slice(1) : int;
  if (!/^\d*$/.test(digits)) return s; // 非纯数字原样返回，避免误格式化
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec === undefined ? `${sign}${grouped}` : `${sign}${grouped}.${dec}`;
}

/** 毫秒时间戳 → 统一管理台时间格式；0/null/undefined/非法 → '-'。 */
function formatTime(ms: number | null | undefined): string {
  if (!ms || !Number.isFinite(Number(ms))) return '-';
  const d = new Date(Number(ms));
  return Number.isNaN(d.getTime()) ? '-' : formatAdminDateTime(d);
}

function pairText(source?: string, target?: string): string {
  return source && target ? `${source}→${target}` : '-';
}

/** datetime-local 字符串（YYYY-MM-DDTHH:mm）→ 毫秒时间戳。 */
function toEpochMs(value: string): number | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.getTime();
}

function parseTxId(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** 货币对字符串展示（详情描述列）。 */
function orDash(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '-';
  return String(v);
}

/* ================================================================== */
/* StatusRail —— 移植源 components/StatusRail.vue（交易生命周期轨道）   */
/* ================================================================== */

/** 主线 8 节点：交易生命周期主路径。 */
const RAIL_MAIN_LINE: ReadonlyArray<{ code: number; name: string }> = [
  { code: 1, name: 'Created' },
  { code: 5, name: 'Quoted' },
  { code: 10, name: 'Confirmed' },
  { code: 20, name: 'Source Transferring' },
  { code: 25, name: 'Source Verified' },
  { code: 30, name: 'Advancing' },
  { code: 35, name: 'Settled' },
  { code: 40, name: 'Completed' },
];

/** 结算腿（钱真正移动的段）：结算金只允许出现在此语义。 */
const RAIL_SETTLE_CODES: Record<number, true> = { 25: true, 30: true, 35: true };

type RailTone = 'danger' | 'info';

/** 分支终态：forkCode 是离开主线前最后经过的主线节点（纯展示近似分叉位置）。 */
const RAIL_BRANCH: Record<number, { name: string; tone: RailTone; forkCode: number }> = {
  50: { name: 'Reversing', tone: 'info', forkCode: 25 },
  60: { name: 'Reversed', tone: 'info', forkCode: 25 },
  70: { name: 'Exception', tone: 'danger', forkCode: 30 },
  80: { name: 'Cancelled', tone: 'info', forkCode: 10 },
  90: { name: 'Failed', tone: 'danger', forkCode: 20 },
};

interface RailStep {
  key: string;
  name: string;
  /** done 已走过 / current 当前位置 / todo 未到达。 */
  state: 'done' | 'current' | 'todo';
  /** 结算腿节点（25/30/35）。 */
  settle: boolean;
  /** 分支终态色调；undefined 表示主线节点。 */
  tone?: RailTone;
}

/** 由状态码推导渲染序列（源 `steps` computed 逻辑 1:1 移植）。 */
function computeRailSteps(status: number): RailStep[] {
  const branch = RAIL_BRANCH[status];
  if (branch) {
    const forkIdx = RAIL_MAIN_LINE.findIndex((n) => n.code === branch.forkCode);
    const head = RAIL_MAIN_LINE.slice(0, forkIdx + 1).map((n) => ({
      key: `m${n.code}`,
      name: n.name,
      settle: !!RAIL_SETTLE_CODES[n.code],
      state: 'done' as const,
    }));
    return [
      ...head,
      {
        key: `b${status}`,
        name: branch.name,
        state: 'current' as const,
        settle: false,
        tone: branch.tone,
      },
    ];
  }
  const curIdx = RAIL_MAIN_LINE.findIndex((n) => n.code === status);
  return RAIL_MAIN_LINE.map((n, i) => ({
    key: `m${n.code}`,
    name: n.name,
    settle: !!RAIL_SETTLE_CODES[n.code],
    state:
      i < curIdx ? ('done' as const) : i === curIdx ? ('current' as const) : ('todo' as const),
  }));
}

/** 圆点配色（主线 teal / 结算金 amber / 终态 danger 红·info 灰 / 未到达空心）。 */
function railDotClass(s: RailStep): string {
  if (s.state === 'current' && s.tone === 'danger') {
    return 'border-red-600 bg-red-600 shadow-[0_0_0_3px_rgba(220,38,38,0.2)]';
  }
  if (s.state === 'current' && s.tone === 'info') {
    return 'border-slate-500 bg-slate-500 shadow-[0_0_0_3px_rgba(100,116,139,0.2)]';
  }
  if (s.state === 'done') {
    return s.settle ? 'border-amber-600 bg-amber-600' : 'border-teal-600 bg-teal-600';
  }
  if (s.state === 'current') {
    return s.settle
      ? 'border-amber-600 bg-amber-600 shadow-[0_0_0_3px_rgba(183,121,31,0.25)]'
      : 'border-teal-600 bg-teal-600 shadow-[0_0_0_3px_rgba(11,107,83,0.2)]';
  }
  return 'border-stone-300 bg-transparent';
}

function railLabelClass(s: RailStep): string {
  if (s.tone === 'danger') return 'font-medium text-red-600';
  if (s.tone === 'info') return 'font-medium text-slate-500';
  if (s.state === 'current') {
    return s.settle ? 'font-medium text-amber-600' : 'font-medium text-teal-600';
  }
  if (s.state === 'done') return 'text-gray-600';
  return 'text-gray-400';
}

/** 连线配色：分支段跟随终态色调，否则 done=teal / 未到达=灰。 */
function railLinkClass(next: RailStep): string {
  if (next.tone === 'danger') return 'bg-red-600';
  if (next.tone === 'info') return 'bg-slate-500';
  return next.state !== 'todo' ? 'bg-teal-600' : 'bg-stone-300';
}

/** StatusRail：横向节点 + 连线，品牌状态机图形语言（纯展示，自包含）。 */
function StatusRail({ status }: { status: number }) {
  const steps = React.useMemo(() => computeRailSteps(status), [status]);
  const current = steps.find((s) => s.state === 'current');
  const ariaLabel = current ? `Transaction status: ${current.name}` : 'Unknown transaction status';
  return (
    <div
      className="flex items-start overflow-x-auto pb-1"
      role="img"
      aria-label={ariaLabel}
    >
      {steps.map((s, i) => {
        const next = steps[i + 1];
        return (
          <React.Fragment key={s.key}>
            <div className="flex flex-shrink-0 flex-col items-center">
              <span className={cn('h-2 w-2 rounded-full border', railDotClass(s))} />
              <span
                className={cn(
                  'mt-1.5 whitespace-nowrap text-xs leading-none',
                  railLabelClass(s),
                )}
              >
                {s.name}
              </span>
            </div>
            {next && (
              <span
                className={cn(
                  'mx-1 mt-[3px] h-0.5 min-w-[12px] flex-1 rounded-sm',
                  railLinkClass(next),
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ================================================================== */
/* 链路：8 阶段轴 + flat 事件（源 drawer 交易链路区）                   */
/* ================================================================== */

const STAGE_STEP_LABEL: Record<number, string> = {
  1: 'Quote',
  2: 'Confirm',
  3: 'Source Transfer',
  4: 'Source Verification',
  5: 'Advancing',
  6: 'Settled',
  7: 'Settlement',
  8: 'Completed',
};

const STAGE_STATUS_LABEL: Record<number, string> = {
  1: 'Not Started',
  2: 'In Progress',
  3: 'Success',
  4: 'Failed',
  5: 'Skipped',
};

const STAGE_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  1: 'outline',
  2: 'secondary',
  3: 'default',
  4: 'destructive',
  5: 'outline',
};

/** 事件类型映射（nodeType；1 环节/状态迁移不在表内，兜底显示数值）。 */
const EVENT_TYPE_LABEL: Record<number, string> = { 2: 'Action', 3: 'Message', 4: 'Retry' };

/** 固定 8 段阶段轴：缺失 step 按未开始补齐（后端补齐 8 行，前端再兜底）。 */
function buildStageList(stages: TransactionStage[]): TransactionStage[] {
  if (stages.length === 0) return [];
  const byStep = new Map<number, TransactionStage>(
    stages.map((s): [number, TransactionStage] => [s.step, s]),
  );
  const list: TransactionStage[] = [];
  for (let step = 1; step <= 8; step++) {
    list.push(
      byStep.get(step) ?? {
        step,
        status: 1,
        startTime: 0,
        endTime: 0,
        operator: '',
        csTxId: '',
        remark: '',
      },
    );
  }
  return list;
}

/** 阶段标题：环节名；跳过阶段追加（跳过）后缀。 */
function stageTitle(s: TransactionStage): string {
  const name = STAGE_STEP_LABEL[s.step] ?? `${s.step}`;
  return s.status === 5 ? `${name} (Skipped)` : name;
}

/**
 * 交易链路视图：纵向 8 阶段轴（可点选切换）+ 当前阶段事件流。
 * 移植源 drawer 的 el-steps + el-timeline（任务要求：纵向步骤 + Badge）。
 */
function TransactionChainView({
  stages,
  events,
}: {
  stages: TransactionStage[];
  events: TransactionFlowEvent[];
}) {
  const stageList = React.useMemo(() => buildStageList(stages), [stages]);
  const [selectedStep, setSelectedStep] = React.useState<number>(1);

  /**
   * 默认选中：首个进行中(2)/失败(4)阶段；否则首个有事件的阶段；再否则 1。
   * 与源 `initSelectedStep` 一致。
   */
  React.useEffect(() => {
    const hit =
      stageList.find((s) => s.status === 2 || s.status === 4) ??
      stageList.find((s) => events.some((e) => e.step === s.step));
    setSelectedStep(hit ? hit.step : 1);
  }, [stageList, events]);

  if (stageList.length === 0) {
    return <p className="text-sm text-muted-foreground">No stage data</p>;
  }

  const currentStage = stageList.find((s) => s.step === selectedStep);
  const selectedEvents = events.filter((e) => e.step === selectedStep);

  return (
    <div className="space-y-4">
      <ol className="space-y-1">
        {stageList.map((s) => {
          const active = s.step === selectedStep;
          return (
            <li key={s.step}>
              <button
                type="button"
                onClick={() => setSelectedStep(s.step)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                  active
                    ? 'border-primary bg-accent'
                    : 'border-transparent hover:bg-accent/50',
                )}
              >
                <span className="font-medium">{s.step}. {stageTitle(s)}</span>
                <Badge variant={STAGE_STATUS_VARIANT[s.status] ?? 'outline'}>
                  {STAGE_STATUS_LABEL[s.status] ?? s.status}
                </Badge>
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatTime(s.startTime)}
                  {s.endTime ? ` → ${formatTime(s.endTime)}` : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div>
        <div className="mb-2 text-sm font-semibold">
          {STAGE_STEP_LABEL[selectedStep] ?? selectedStep}
          {currentStage
            ? ` (${STAGE_STATUS_LABEL[currentStage.status] ?? currentStage.status})`
            : ''}
        </div>
        {selectedEvents.length ? (
          <ul className="space-y-3">
            {selectedEvents.map((e) => (
              <li key={e.flowId} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {EVENT_TYPE_LABEL[e.nodeType] ?? `Event type ${e.nodeType}`}
                  </Badge>
                  {(e.statusFrom !== 0 || e.statusTo !== 0) && (
                    <span className="text-muted-foreground">
                      {TRANSACTION_STATUS_LABEL[e.statusFrom] ?? e.statusFrom} →{' '}
                      {TRANSACTION_STATUS_LABEL[e.statusTo] ?? e.statusTo}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatTime(e.eventTime)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Operator: {orDash(e.operator)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Currency System Transaction ID: {orDash(e.csTxId)}
                </div>
                {e.remark && (
                  <div className="text-xs text-muted-foreground">Remarks: {e.remark}</div>
                )}
                {e.traceId && (
                  <div className="text-xs text-muted-foreground">
                    traceId: {e.traceId}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No event details for this stage</p>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/* 通用展示组件                                                        */
/* ================================================================== */

/** 交易状态 Badge（列表/详情共用）。 */
function TransactionStatusBadge({ status }: { status: number }) {
  return (
    <Badge variant={TRANSACTION_STATUS_VARIANT[status] ?? 'secondary'}>
      {TRANSACTION_STATUS_LABEL[status] ?? String(status)}
    </Badge>
  );
}

/** 详情描述字段（el-descriptions-item 的 React 等价）。 */
function DescField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function DescGrid({
  cols = 2,
  className,
  children,
}: {
  cols?: 1 | 2;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <dl
      className={cn(
        'grid gap-x-4 gap-y-3',
        cols === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1',
        className,
      )}
    >
      {children}
    </dl>
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

/* ================================================================== */
/* 异常处置 Dialog（源 resolve-dialog.vue）                             */
/* ================================================================== */

const RESOLVE_ACTION_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '1', label: 'Complete' },
  { value: '2', label: 'Failed' },
  { value: '3', label: 'Reversal Completed' },
];

const RESOLVE_SUCCESS_MSG: Record<string, string> = {
  1: 'Transaction marked as completed',
  2: 'Transaction marked as failed',
  3: 'Reversal resolution completed',
};

/**
 * 交易异常处置弹窗。入口仅 EXCEPTION(70) 行可见（与后端「仅 70 可裁定」一致）。
 * action 1 完成 / 2 失败 / 3 冲正完成（设计 S2）。
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
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Transaction Exception Resolution</DialogTitle>
          <DialogDescription>Only transactions in Exception (70) status can be resolved.</DialogDescription>
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
              {row ? formatMoney(row.userDeduction) : '-'}
            </DescField>
          </div>

          {/* 处置方式（源 el-radio-group） */}
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
            <p className="text-xs text-muted-foreground">
              Complete: backfill the settlement record and send the final-state notification; the transaction moves to Completed
              <br />
              Failed: the transaction moves to Failed and the failure reason is recorded
              <br />
              Reversal Completed: create or complete the reversal order; the transaction moves to Reversed
            </p>
          </div>

          {/* 裁定原因（选填，入 flow 留痕） */}
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

/* ================================================================== */
/* 列表核心（交易查询 / 异常处理 / 冲正记录 共用）                       */
/* ================================================================== */

type TxListMode = 'all' | 'exception' | 'reversal';

/** Select 的「全部」哨兵值（Radix SelectItem 不宜用空串，故用哨兵）。 */
const OPT_ALL = '__all__';

interface TxFilterForm {
  txNo: string;
  txUuid: string;
  transactionId: string;
  status: string;
  lpId: string;
  pairId: string;
  sourceBankId: string;
  targetBankId: string;
  createTimeStart: string;
  createTimeEnd: string;
}

function defaultFilterForm(mode: TxListMode): TxFilterForm {
  return {
    txNo: '',
    txUuid: '',
    transactionId: '',
    status: mode === 'exception' ? '70' : mode === 'reversal' ? '50' : OPT_ALL,
    lpId: OPT_ALL,
    pairId: OPT_ALL,
    sourceBankId: OPT_ALL,
    targetBankId: OPT_ALL,
    createTimeStart: '',
    createTimeEnd: '',
  };
}

/** RHF 筛选表单 → 后端 TransactionPageFilter；空/哨兵字段剔除。 */
function formToFilter(form: TxFilterForm, mode: TxListMode): TransactionPageFilter {
  const f: TransactionPageFilter = {};
  const txNo = form.txNo.trim();
  if (txNo) f.txNo = txNo;
  const txUuid = form.txUuid.trim();
  if (txUuid) f.txUuid = txUuid;
  if (form.transactionId) {
    const n = Number(form.transactionId);
    if (Number.isFinite(n) && n > 0) f.transactionId = n;
  }
  if (form.lpId !== OPT_ALL) f.lpId = Number(form.lpId);
  if (form.pairId !== OPT_ALL) f.pairId = Number(form.pairId);
  if (form.sourceBankId !== OPT_ALL) f.sourceBankId = Number(form.sourceBankId);
  if (form.targetBankId !== OPT_ALL) f.targetBankId = Number(form.targetBankId);
  // 异常模式强制 status=70；其余按表单值（哨兵视为不过滤）。
  if (mode === 'exception') f.status = 70;
  else if (form.status && form.status !== OPT_ALL) f.status = Number(form.status);
  if (form.createTimeStart) {
    const ms = toEpochMs(form.createTimeStart);
    if (ms) f.createTimeStart = ms;
  }
  if (form.createTimeEnd) {
    const ms = toEpochMs(form.createTimeEnd);
    if (ms) f.createTimeEnd = ms;
  }
  return f;
}

const PAGE_SIZE_DEFAULT = 10;

/**
 * 交易列表核心。三种模式：
 *  - all       交易查询（全状态，状态筛选可选）
 *  - exception 异常处理（status 锁定 70；处置入口对全部行可见）
 *  - reversal  冲正记录（status 限定 50/60；无处置入口；详情跳交易查询详情）
 */
function TransactionListCore({
  mode,
  title,
  detailModule,
}: {
  mode: TxListMode;
  title: string;
  detailModule: string;
}) {
  const router = useRouter();
  const { register, handleSubmit, reset, control } = useForm<TxFilterForm>({
    defaultValues: defaultFilterForm(mode),
  });

  const [filter, setFilter] = React.useState<TransactionPageFilter>(() =>
    formToFilter(defaultFilterForm(mode), mode),
  );
  const [pageNum, setPageNum] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);
  const [showMore, setShowMore] = React.useState(false);
  const [resolveRow, setResolveRow] = React.useState<TransactionRow | null>(null);
  const [resolveOpen, setResolveOpen] = React.useState(false);

  const { data, isLoading } = useTransactionListQuery(KISSEN_PROJECT_ID, {
    pageNum,
    pageSize,
    filter,
  });
  const { data: lpOptions } = useTransactionLpOptionsQuery(KISSEN_PROJECT_ID);
  const { data: pairOptions } = useTransactionPairOptionsQuery(KISSEN_PROJECT_ID);
  const { data: bankOptions } = useTransactionBankOptionsQuery(KISSEN_PROJECT_ID);

  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;

  const onSubmit = React.useCallback(
    (form: TxFilterForm) => {
      setFilter(formToFilter(form, mode));
      setPageNum(1);
    },
    [mode],
  );

  const onReset = React.useCallback(() => {
    const fresh = defaultFilterForm(mode);
    reset(fresh);
    setFilter(formToFilter(fresh, mode));
    setPageNum(1);
  }, [mode, reset]);

  const onView = React.useCallback(
    (txId: number) => {
      router.push(`/${detailModule}/detail?id=${txId}`);
    },
    [router, detailModule],
  );

  const openResolve = React.useCallback((row: TransactionRow) => {
    setResolveRow(row);
    setResolveOpen(true);
  }, []);

  const columns = React.useMemo<
    ColumnDef<TransactionRow & { id: string }>[]
  >(() => {
    return [
      {
        id: 'txNo',
        header: 'Transaction No.',
        cell: ({ row }) => <span>{row.original.txNo || '-'}</span>,
      },
      {
        id: 'transactionId',
        header: 'Transaction ID',
        cell: ({ row }) => <span>{row.original.transactionId}</span>,
      },
      {
        id: 'txUuid',
        header: 'txUuid',
        cell: ({ row }) => (
          <span
            className="block max-w-[180px] truncate"
            title={row.original.txUuid}
          >
            {row.original.txUuid || '-'}
          </span>
        ),
      },
      {
        id: 'pair',
        header: 'Currency Pair',
        cell: ({ row }) => (
          <span>
            {pairText(row.original.sourceCurrency, row.original.targetCurrency)}
          </span>
        ),
      },
      {
        id: 'lpName',
        header: 'LP',
        cell: ({ row }) => <span>{row.original.lpName || '-'}</span>,
      },
      {
        id: 'banks',
        header: 'Source Bank → Target Bank',
        cell: ({ row }) => (
          <span>
            {row.original.sourceBankName || '-'}→{row.original.targetBankName || '-'}
          </span>
        ),
      },
      {
        id: 'principal',
        header: 'Principal',
        cell: ({ row }) => <span>{formatMoney(row.original.principal)}</span>,
      },
      {
        id: 'userDeduction',
        header: 'User Deduction',
        cell: ({ row }) => <span>{formatMoney(row.original.userDeduction)}</span>,
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <TransactionStatusBadge status={row.original.status} />,
      },
      {
        id: 'createTime',
        header: 'Creation Time',
        cell: ({ row }) => <span>{formatTime(row.original.createTime)}</span>,
      },
      {
        id: 'completedTime',
        header: 'Completion Time',
        cell: ({ row }) => <span>{formatTime(row.original.completedTime)}</span>,
      },
      createActionColumn<TransactionRow & { id: string }>((item) => {
        // 处置入口仅 EXCEPTION(70) 行可见；冲正模式行恒为 50/60，不会出现。
        const actions: TableRowAction<TransactionRow & { id: string }>[] = [
          { label: 'View', onClick: () => onView(item.transactionId) },
        ];
        if (item.status === 70) {
          actions.push({
            label: 'Resolve',
            destructive: true,
            onClick: () => openResolve(item),
          });
        }
        return actions;
      }),
    ];
  }, [onView, openResolve]);

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.transactionId) })),
    [rows],
  );

  // 下拉选项（首项「全部」哨兵；冲正模式状态仅 50/60）。
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
        label: `${p.sourceCurrency}→${p.targetCurrency}`,
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
  const statusSelectOptions = React.useMemo(() => {
    if (mode === 'reversal') {
      return TX_STATUS_OPTIONS.filter(
        (o) => o.value === '50' || o.value === '60',
      );
    }
    return [{ value: OPT_ALL, label: 'All' }, ...TX_STATUS_OPTIONS];
  }, [mode]);

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
      >
        <div className="mb-4 text-sm font-semibold">Filters</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            name="txNo"
            label="Transaction No."
            placeholder="Exact match"
            maxLength={32}
            register={register('txNo')}
          />
          {mode !== 'exception' && (
            <FormSelect
              name="status"
              control={control}
              label="Status"
              options={statusSelectOptions}
              placeholder="All"
            />
          )}
          <FilterableFormSelect
            name="lpId"
            control={control}
            label="LP"
            options={lpSelectOptions}
            placeholder="All"
          />
          <FilterableFormSelect
            name="pairId"
            control={control}
            label="Currency Pair"
            options={pairSelectOptions}
            placeholder="All"
          />
          <FormField
            name="createTimeStart"
            label="Creation Start Time"
            type="datetime-local"
            register={register('createTimeStart')}
          />
          <FormField
            name="createTimeEnd"
            label="Creation End Time"
            type="datetime-local"
            register={register('createTimeEnd')}
          />
        </div>

        {showMore && (
          <div className="mt-4 grid grid-cols-1 gap-4 border-t pt-4 md:grid-cols-2 xl:grid-cols-3">
            <FormField
              name="transactionId"
              label="Transaction ID"
              placeholder="Exact match"
              type="number"
              register={register('transactionId')}
            />
            <FormField
              name="txUuid"
              label="txUuid"
              placeholder="Exact match"
              maxLength={64}
              register={register('txUuid')}
            />
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
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit">Search</Button>
          <Button type="button" variant="outline" onClick={onReset}>
            Reset
          </Button>
          <Button
            type="button"
            variant="link"
            className="h-auto p-0"
            onClick={() => setShowMore((v) => !v)}
          >
            {showMore ? 'Collapse Filters' : 'More Filters'}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border-border/60 bg-card shadow-float">
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-3">
          <div className="text-sm font-semibold">{title}</div>
        </div>
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          emptyMessage="No transaction data"
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
      </div>

      <ResolveDialog
        row={resolveRow}
        open={resolveOpen}
        onOpenChange={setResolveOpen}
      />
    </div>
  );
}

/* ================================================================== */
/* 详情核心（交易查询详情 / 异常详情 共用）                              */
/* ================================================================== */

function TransactionDetailCore() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const txId = parseTxId(searchParams.get('id'));

  const { data: detail, isLoading: detailLoading } = useTransactionDetailQuery(
    KISSEN_PROJECT_ID,
    txId,
  );
  const { data: chain, isLoading: chainLoading } = useTransactionChainQuery(
    KISSEN_PROJECT_ID,
    txId,
  );

  if (!txId) {
    return (
      <div className="rounded-lg border-border/60 bg-card p-6 shadow-float">
        <p className="text-sm text-muted-foreground">Missing transaction ID; unable to view details.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.back()}
        >
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">Transaction Details</h1>
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          Back
        </Button>
      </div>

      {detailLoading && !detail ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      ) : detail ? (
        <DetailBody
          detail={detail}
          stages={chain?.stages ?? []}
          events={chain?.events ?? []}
          chainLoading={chainLoading && !chain}
        />
      ) : (
        <div className="rounded-lg border-border/60 bg-card p-6 text-sm text-muted-foreground shadow-float">
          No transaction detail data.
        </div>
      )}
    </div>
  );
}

/** 详情正文（拆出以便 detail 就绪后单独渲染）。 */
function DetailBody({
  detail,
  stages,
  events,
  chainLoading,
}: {
  detail: TransactionDetailRow;
  stages: TransactionStage[];
  events: TransactionFlowEvent[];
  chainLoading: boolean;
}) {
  return (
    <>
      {/* 状态轨道（移植源 StatusRail） */}
      <section className="space-y-3 rounded-lg border-border/60 bg-card p-6 shadow-float">
        <div className="text-xs font-medium tracking-wide text-muted-foreground">
          SETTLEMENT RAIL
        </div>
        <StatusRail status={detail.status} />
      </section>

      {/* 基本信息 */}
      <section className="rounded-lg border-border/60 bg-card p-6 shadow-float">
        <div className="mb-4 text-sm font-semibold">Basic Information</div>
        <DescGrid cols={2}>
          <DescField label="Transaction No.">{orDash(detail.txNo)}</DescField>
          <DescField label="Transaction ID">{detail.transactionId}</DescField>
          <DescField label="txUuid">{orDash(detail.txUuid)}</DescField>
          <DescField label="Currency Pair">
            {pairText(detail.sourceCurrency, detail.targetCurrency)}
          </DescField>
          <DescField label="LP">{orDash(detail.lpName)}</DescField>
          <DescField label="Source Bank">{orDash(detail.sourceBankName)}</DescField>
          <DescField label="Target Bank">{orDash(detail.targetBankName)}</DescField>
          <DescField label="Status">
            <TransactionStatusBadge status={detail.status} />
          </DescField>
          <DescField label="Creation Time">{formatTime(detail.createTime)}</DescField>
          <DescField label="Completion Time">{formatTime(detail.completedTime)}</DescField>
        </DescGrid>
      </section>

      {/* 金额与汇率 */}
      <section className="rounded-lg border-border/60 bg-card p-6 shadow-float">
        <div className="mb-4 text-sm font-semibold">Amounts & Rates</div>
        <DescGrid cols={2}>
          <DescField label="Principal">{formatMoney(detail.principal)}</DescField>
          <DescField label="Markup Rate">{orDash(detail.markupRate)}</DescField>
          <DescField label="User Deduction">{formatMoney(detail.userDeduction)}</DescField>
          <DescField label="Base Rate">{orDash(detail.baseRate)}</DescField>
          <DescField label="Receiver Amount">{formatMoney(detail.receiverAmount)}</DescField>
          <DescField label="User Rate">{orDash(detail.userRate)}</DescField>
        </DescGrid>
      </section>

      {/* 账户 */}
      <section className="rounded-lg border-border/60 bg-card p-6 shadow-float">
        <div className="mb-4 text-sm font-semibold">Accounts</div>
        <DescGrid cols={1}>
          <DescField label="Sender Account">{orDash(detail.senderAccount)}</DescField>
          <DescField label="Receiver Account">{orDash(detail.receiverAccount)}</DescField>
          <DescField label="Source Currency System Transaction ID">{orDash(detail.sourceCsTxId)}</DescField>
          <DescField label="Target Currency System Transaction ID">
            {orDash(detail.targetCsTxId)}
          </DescField>
        </DescGrid>
      </section>

      {/* 时间轴 */}
      <section className="rounded-lg border-border/60 bg-card p-6 shadow-float">
        <div className="mb-4 text-sm font-semibold">Timeline</div>
        <DescGrid cols={2}>
          <DescField label="Quote Version">{detail.quoteVersion}</DescField>
          <DescField label="Quote Expiry Time">{formatTime(detail.quoteExpireTime)}</DescField>
          <DescField label="Confirmation Window Expiry">{formatTime(detail.confirmExpireTime)}</DescField>
          <DescField label="Confirmation Time">{formatTime(detail.confirmTime)}</DescField>
          <DescField label="Source Verification Time">{formatTime(detail.sourceVerifiedTime)}</DescField>
          <DescField label="Advancing Time">{formatTime(detail.advancingTime)}</DescField>
          <DescField label="Settled Time">{formatTime(detail.settledTime)}</DescField>
          <DescField label="Completion Time">{formatTime(detail.completedTime)}</DescField>
        </DescGrid>
      </section>

      {/* 失败原因 */}
      <section className="rounded-lg border-border/60 bg-card p-6 shadow-float">
        <div className="mb-4 text-sm font-semibold">Failure Reason</div>
        <DescGrid cols={1}>
          <DescField label="Failure Reason">{orDash(detail.failReason)}</DescField>
          <DescField label="Remarks">{orDash(detail.remark)}</DescField>
        </DescGrid>
      </section>

      {/* 交易链路（8 阶段轴 + 事件流） */}
      <section className="rounded-lg border-border/60 bg-card p-6 shadow-float">
        <div className="mb-4 text-sm font-semibold">Transaction Chain</div>
        {chainLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        ) : (
          <TransactionChainView stages={stages} events={events} />
        )}
      </section>
    </>
  );
}
/* ================================================================== */
/* 导出页（registry 依赖，名字不可改）                                  */
/* ================================================================== */

/** 交易查询列表（全状态）。 */
export function TxListListPage() {
  return <TransactionListCore mode="all" title="Transactions" detailModule="tx-list" />;
}

/** 交易查询详情。 */
export function TxListDetailPage() {
  return <TransactionDetailCore />;
}

/** 异常处理列表（status=70 过滤视图）。 */
export function TxExceptionListPage() {
  return (
    <TransactionListCore mode="exception" title="Exception Handling" detailModule="tx-exception" />
  );
}

/** 异常处理详情。 */
export function TxExceptionDetailPage() {
  return <TransactionDetailCore />;
}

/**
 * 冲正记录列表（status 50/60 过滤视图；源无独立页）。
 * 后端 status 为单值过滤，故状态下拉仅提供 50（冲正中）/60（已冲正）二选一。
 * 详情跳「交易查询」详情（tx-reversal 无独立详情路由）。
 */
export function TxReversalListPage() {
  return <TransactionListCore mode="reversal" title="Reversal Records" detailModule="tx-list" />;
}
