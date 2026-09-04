'use client';

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
import { Check, ChevronsUpDown } from 'lucide-react';

import {
  Alert,
  AlertTitle,
  Badge,
  Button,
  CopyableEllipsisText,
  createActionColumn,
  DataTable,
  type TableRowAction,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
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
 * v2.0 全量补同步（01 文档 §D7 + 裁决 6/7）：
 *  - tx-exception / tx-reversal 拆页退役，合并为单页 TxListListPage；
 *    处置入口按行 status(70) 显隐。
 *  - 详情由路由页收回 720px 抽屉（源 tx-detail-drawer.vue 照迁）。
 *  - 「更多筛选」仅源/目标银行（transactionId/txUuid 不暴露，裁决 6）。
 *
 * 导出（registry 依赖，名字不可改）：TxListListPage。
 */

/* ================================================================== */
/* 展示工具（源 views/approval/format.ts + index.vue fmtAmount）        */
/* ================================================================== */

/** 数字千分位（保留原小数位）；源 resolve-dialog formatMoney。 */
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

/**
 * 金额/汇率展示：千分位 + 至少 2 位小数（最多 8 位，去尾零但保 2 位）。
 * 源 index.vue fmtAmount / tx-detail-drawer.vue fmtAmount·fmtRate。
 */
function fmtAmount(v: number | string | null | undefined): string {
  if (v == null || v === '') return '-';
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
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

/** 空值兜底展示（源 `|| '-'` 口径）。 */
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
/* 链路：8 阶段卡片 + 定宽时间列事件行（源 drawer 2026-08-27 降噪重排）  */
/* ================================================================== */

/** 阶段轴 step 1-8（源 STAGE_STEP_MAP：报价/确认/源端划转/源端验证/垫资解付/入账/结算/完成）。 */
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

/** 阶段状态 1 未开始 / 2 进行中 / 3 成功 / 4 失败 / 5 跳过。 */
const STAGE_STATUS_LABEL: Record<number, string> = {
  1: 'Not Started',
  2: 'In Progress',
  3: 'Success',
  4: 'Failed',
  5: 'Skipped',
};

/** 阶段状态 tag 语义（源 stageTagType：3 success / 4 danger / 2 warning / 其余 info）。 */
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

/** 事件类型映射（nodeType；1 环节/状态迁移不在表内，兜底显示 Event N）。 */
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

/** 阶段标题：环节名；跳过阶段追加 (Skipped) 后缀（源 stageTitle）。 */
function stageTitle(s: TransactionStage): string {
  const name = STAGE_STEP_LABEL[s.step] ?? `${s.step}`;
  return s.status === 5 ? `${name} (Skipped)` : name;
}

interface ChainNode {
  stage: TransactionStage;
  events: TransactionFlowEvent[];
}

/**
 * 链路节点（源 treeNodes computed 照迁）：固定 8 段补齐 + 每阶段挂自身事件，
 * 过滤规则 `stage.status !== 1 || events.length > 0` 才渲染（未开始且无事件的阶段隐藏）。
 */
function buildChainNodes(stages: TransactionStage[], events: TransactionFlowEvent[]): ChainNode[] {
  const list = buildStageList(stages);
  if (list.length === 0) return [];
  return list
    .map((stage) => ({
      stage,
      events: events.filter((e) => e.step === stage.step),
    }))
    .filter((n) => n.stage.status !== 1 || n.events.length > 0);
}

/** 交易链路视图：阶段一张卡，事件行定宽等宽时间列对齐（源 .chain-card/.chain-event）。 */
function TransactionChainView({
  stages,
  events,
}: {
  stages: TransactionStage[];
  events: TransactionFlowEvent[];
}) {
  const nodes = React.useMemo(() => buildChainNodes(stages, events), [stages, events]);

  if (nodes.length === 0) {
    return <p className="text-sm text-muted-foreground">No chain data</p>;
  }

  return (
    <div className="space-y-2.5">
      {nodes.map(({ stage, events: stageEvents }) => (
        <div
          key={stage.step}
          className={cn(
            'rounded-lg border p-3',
            stage.status === 4 && 'border-destructive/40 bg-destructive/5',
            stage.status === 5 && 'opacity-55',
          )}
        >
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'h-2 w-2 flex-shrink-0 rounded-full',
                stage.status === 4
                  ? 'bg-destructive'
                  : stage.status === 5
                    ? 'bg-muted-foreground'
                    : 'bg-[var(--ks-clearing,#0b6b53)]',
              )}
            />
            <span className="text-sm font-semibold">{stageTitle(stage)}</span>
            <Badge variant={STAGE_STATUS_VARIANT[stage.status] ?? 'outline'}>
              {STAGE_STATUS_LABEL[stage.status] ?? stage.status}
            </Badge>
            {stage.endTime !== 0 && (
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {formatTime(stage.endTime)}
              </span>
            )}
          </div>
          {stage.csTxId && (
            <div className="mt-1.5 font-mono text-xs text-muted-foreground">
              Currency System Tx ID: {stage.csTxId}
            </div>
          )}
          {stageEvents.length > 0 && (
            <div className="mt-2">
              {stageEvents.map((ev) => (
                <div
                  key={ev.flowId}
                  className="border-t border-dashed py-1.5 first:border-t-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-[148px] flex-shrink-0 font-mono text-xs text-muted-foreground">
                      {formatTime(ev.eventTime)}
                    </span>
                    <Badge variant="outline" className="text-[11px]">
                      {EVENT_TYPE_LABEL[ev.nodeType] ?? `Event ${ev.nodeType}`}
                    </Badge>
                    {(ev.statusFrom !== 0 || ev.statusTo !== 0) && (
                      <span className="text-xs text-muted-foreground">
                        {TRANSACTION_STATUS_LABEL[ev.statusFrom] ?? ev.statusFrom} →{' '}
                        {TRANSACTION_STATUS_LABEL[ev.statusTo] ?? ev.statusTo}
                      </span>
                    )}
                    {ev.operator && (
                      <span className="text-xs text-muted-foreground">
                        Operator: {ev.operator}
                      </span>
                    )}
                  </div>
                  {ev.remark && (
                    <div className="mt-0.5 break-all pl-[156px] text-xs text-muted-foreground/80">
                      {ev.remark}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ================================================================== */
/* 通用展示组件                                                        */
/* ================================================================== */

/** 交易状态 Badge（列表/详情/事件流共用；模型层 13 值映射）。 */
function TransactionStatusBadge({ status }: { status: number }) {
  return (
    <Badge variant={TRANSACTION_STATUS_VARIANT[status] ?? 'secondary'}>
      {TRANSACTION_STATUS_LABEL[status] ?? String(status)}
    </Badge>
  );
}

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
              {row ? formatMoney(row.userDeduction) : '-'}
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

/* ================================================================== */
/* 详情抽屉（源 tx-detail-drawer.vue，720px）                           */
/* ================================================================== */

/** 源抽屉尺寸 720px（el-drawer size="720px"）。 */
const DRAWER_WIDTH_CLASS = 'flex flex-col sm:max-w-[720px]';

/**
 * 交易详情抽屉：detail 与 chain 并行拉取（源 loadAll Promise.all），
 * 链路供阶段树、详情供字段分组。
 */
function TxDetailDrawer({
  txId,
  open,
  onOpenChange,
}: {
  txId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: detail, isLoading: detailLoading } = useTransactionDetailQuery(
    KISSEN_PROJECT_ID,
    txId,
  );
  const { data: chain, isLoading: chainLoading } = useTransactionChainQuery(
    KISSEN_PROJECT_ID,
    txId,
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={DRAWER_WIDTH_CLASS}>
        <DrawerHeader>
          <DrawerTitle>Transaction Details</DrawerTitle>
          <DrawerDescription>
            {detail
              ? `Transaction No. ${detail.txNo || `#${txId}`}`
              : `Transaction #${txId}`}
          </DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pb-4">
          {detailLoading && !detail ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-lg" />
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
            <p className="text-sm text-muted-foreground">
              No transaction detail data.
            </p>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** 详情正文（源 drawer 四块：交易信息 / 转账信息双卡 / 其他信息 / 交易链路）。 */
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
    <div className="space-y-6">
      {/* Hero Summary：单号（可复制）+ 状态 + 交易对 + LP（§6.3 详情模板） */}
      <section className="rounded-lg border border-border/60 bg-card px-4 py-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <CopyableEllipsisText
              value={detail.txNo || undefined}
              emptyText="-"
              maxWidth={280}
              className="font-mono text-sm font-semibold text-foreground"
            />
            <TransactionStatusBadge status={detail.status} />
          </div>
          {((detail.sourceCurrency && detail.targetCurrency) || detail.lpName) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {detail.sourceCurrency && detail.targetCurrency ? (
                <span className="inline-flex items-center gap-1">
                  <Badge variant="outline" className="rounded-full">
                    {detail.sourceCurrency}
                  </Badge>
                  <span className="text-xs">→</span>
                  <Badge className="rounded-full">{detail.targetCurrency}</Badge>
                </span>
              ) : null}
              {detail.lpName ? <span>LP · {detail.lpName}</span> : null}
            </div>
          )}
        </div>
      </section>

      {/* 状态轨道（源 .rail-block：SETTLEMENT RAIL 置顶 + hairline 分隔） */}
      <section className="space-y-3 border-b pb-5">
        <div className="text-xs font-medium tracking-wide text-muted-foreground">
          SETTLEMENT RAIL
        </div>
        <StatusRail status={detail.status} />
      </section>

      {/* 块一：交易信息（源 el-descriptions :column="2"；单号/状态/交易对/LP 已上移 Hero） */}
      <section>
        <h4 className="mb-3 text-sm font-semibold">Transaction Information</h4>
        <DescGrid cols={2}>
          <DescField label="Principal">
            <span className="font-mono tabular-nums">{fmtAmount(detail.principal)}</span>
          </DescField>
          <DescField label="Receiver Amount">
            <span className="font-mono tabular-nums">{fmtAmount(detail.receiverAmount)}</span>
          </DescField>
          <DescField label="Markup Rate">
            <span className="font-mono tabular-nums">{fmtAmount(detail.markupRate)}</span>
          </DescField>
          <DescField label="Base Rate / User Rate">
            <span className="font-mono tabular-nums">
              {fmtAmount(detail.baseRate)} / {fmtAmount(detail.userRate)}
            </span>
          </DescField>
          <DescField label="User Deduction">
            <span className="font-mono tabular-nums">{fmtAmount(detail.userDeduction)}</span>
          </DescField>
          <DescField label="Quote Version">
            <span className="font-mono tabular-nums">v{detail.quoteVersion}</span>
          </DescField>
        </DescGrid>
      </section>

      {/* 块二：转账信息（源端/目标端双卡 + 箭头，源 .leg-grid；卡面走 P3 panel 公式） */}
      <section>
        <h4 className="mb-3 text-sm font-semibold">
          Transfer Information (Source → Target)
        </h4>
        <div className="flex items-stretch gap-2.5">
          <div className="min-w-0 flex-1 rounded-lg border border-border/60 bg-card p-3">
            <div className="mb-2 text-sm font-semibold">
              Source · {detail.sourceBankName || 'Source Bank'}
            </div>
            <DescGrid cols={1}>
              <DescField label="Sender Account">
                <CopyableEllipsisText
                  value={detail.senderAccount || undefined}
                  emptyText="-"
                  maxWidth={280}
                  className="font-mono"
                />
              </DescField>
              <DescField label="Deduction Principal">
                <span className="font-mono tabular-nums">{fmtAmount(detail.userDeduction)}</span>
              </DescField>
              <DescField label="Currency System Tx ID">
                <CopyableEllipsisText
                  value={detail.sourceCsTxId || undefined}
                  emptyText="-"
                  maxWidth={280}
                  className="font-mono"
                />
              </DescField>
              <DescField label="Source Verified Time">
                {formatTime(detail.sourceVerifiedTime)}
              </DescField>
            </DescGrid>
          </div>
          <div className="flex-shrink-0 self-center text-lg text-muted-foreground">→</div>
          <div className="min-w-0 flex-1 rounded-lg border border-border/60 bg-card p-3">
            <div className="mb-2 text-sm font-semibold text-[var(--ks-clearing,#0b6b53)]">
              Target · {detail.targetBankName || 'Target Bank'}
            </div>
            <DescGrid cols={1}>
              <DescField label="Receiver Account">
                <CopyableEllipsisText
                  value={detail.receiverAccount || undefined}
                  emptyText="-"
                  maxWidth={280}
                  className="font-mono"
                />
              </DescField>
              <DescField label="Receiver Amount">
                <span className="font-mono tabular-nums">{fmtAmount(detail.receiverAmount)}</span>
              </DescField>
              <DescField label="Currency System Tx ID">
                <CopyableEllipsisText
                  value={detail.targetCsTxId || undefined}
                  emptyText="-"
                  maxWidth={280}
                  className="font-mono"
                />
              </DescField>
              <DescField label="Settled / Credited Time">
                {detail.settledTime !== 0
                  ? formatTime(detail.settledTime)
                  : detail.advancingTime !== 0
                    ? formatTime(detail.advancingTime)
                    : '-'}
              </DescField>
            </DescGrid>
          </div>
        </div>
      </section>

      {/* 其他信息（源 :column="2"；长文本单独占行，§6.3） */}
      <section>
        <h4 className="mb-3 text-sm font-semibold">Other Information</h4>
        <DescGrid cols={2}>
          <DescField label="Creation Time">{formatTime(detail.createTime)}</DescField>
          <DescField label="Completion Time">{formatTime(detail.completedTime)}</DescField>
          <DescField label="Failure Reason" span>
            {orDash(detail.failReason)}
          </DescField>
          <DescField label="Remarks" span>
            {orDash(detail.remark)}
          </DescField>
        </DescGrid>
      </section>

      {/* 块三：交易链路（阶段卡 + 定宽时间列事件行） */}
      <section>
        <h4 className="mb-3 text-sm font-semibold">Transaction Chain</h4>
        {chainLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <TransactionChainView stages={stages} events={events} />
        )}
      </section>
    </div>
  );
}

/* ================================================================== */
/* 列表页核心（源 index.vue，单页全状态）                               */
/* ================================================================== */

interface TxFilterForm {
  txNo: string;
  status: string;
  lpId: string;
  pairId: string;
  sourceBankId: string;
  targetBankId: string;
  createTimeStart: string;
  createTimeEnd: string;
}

function defaultFilterForm(): TxFilterForm {
  return {
    txNo: '',
    status: OPT_ALL,
    lpId: OPT_ALL,
    pairId: OPT_ALL,
    sourceBankId: OPT_ALL,
    targetBankId: OPT_ALL,
    createTimeStart: '',
    createTimeEnd: '',
  };
}

/** 将详情页跳转携带的毫秒时间戳转换为 datetime-local 输入值。 */
function toDateTimeLocalInput(value: string | null): string {
  const ms = Number(value);
  if (!value || !Number.isFinite(ms)) return '';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 交易列表深链筛选：结算单详情跳转时按 LP 和结算周期回填条件。 */
function filterFormFromSearchParams(searchParams: {
  get: (name: string) => string | null;
}): TxFilterForm {
  const form = defaultFilterForm();
  const lpId = searchParams.get('lpId');
  if (lpId && Number.isInteger(Number(lpId)) && Number(lpId) > 0) {
    form.lpId = lpId;
  }
  form.createTimeStart = toDateTimeLocalInput(searchParams.get('createTimeStart'));
  form.createTimeEnd = toDateTimeLocalInput(searchParams.get('createTimeEnd'));
  return form;
}

/** RHF 筛选表单 → 后端 TransactionPageFilter；空/哨兵字段剔除。 */
function formToFilter(form: TxFilterForm): TransactionPageFilter {
  const f: TransactionPageFilter = {};
  const txNo = form.txNo.trim();
  if (txNo) f.txNo = txNo;
  if (form.status && form.status !== OPT_ALL) f.status = Number(form.status);
  if (form.lpId !== OPT_ALL) f.lpId = Number(form.lpId);
  if (form.pairId !== OPT_ALL) f.pairId = Number(form.pairId);
  if (form.sourceBankId !== OPT_ALL) f.sourceBankId = Number(form.sourceBankId);
  if (form.targetBankId !== OPT_ALL) f.targetBankId = Number(form.targetBankId);
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

function TransactionListCore() {
  const searchParams = useSearchParams();
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
  const [showMore, setShowMore] = React.useState(false);
  const [resolveRow, setResolveRow] = React.useState<TransactionRow | null>(null);
  const [resolveOpen, setResolveOpen] = React.useState(false);
  const [drawerTxId, setDrawerTxId] = React.useState<number | null>(null);

  const { data, isLoading, isError, dataUpdatedAt } = useTransactionListQuery(KISSEN_PROJECT_ID, {
    pageNum,
    pageSize,
    filter,
  });
  // 下拉三组并行拉取（源 loadOptions Promise.all → 三个独立 query 挂载即并行）。
  const { data: lpOptions } = useTransactionLpOptionsQuery(KISSEN_PROJECT_ID);
  const { data: pairOptions } = useTransactionPairOptionsQuery(KISSEN_PROJECT_ID);
  const { data: bankOptions } = useTransactionBankOptionsQuery(KISSEN_PROJECT_ID);

  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;

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

  const onView = React.useCallback((row: TransactionRow) => {
    setDrawerTxId(row.transactionId);
  }, []);

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
        cell: ({ row }) => (
          <span className="font-mono">{row.original.txNo || '-'}</span>
        ),
      },
      {
        id: 'tokens',
        header: 'Tokens',
        cell: ({ row }) => {
          const r = row.original;
          const banks = `${r.sourceBankName || '-'} → ${r.targetBankName || '-'}`;
          return (
            <div className="flex min-w-0 flex-col leading-snug">
              <span className="font-mono text-[13px] font-semibold">
                {r.sourceCurrency || '-'}/{r.targetCurrency || '-'}
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
        header: 'From (Wallet / Amount)',
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col leading-snug">
            <span
              className="max-w-[190px] truncate font-mono"
              title={row.original.senderAccount}
            >
              {row.original.senderAccount || '-'}
            </span>
            <span className="text-xs text-muted-foreground">
              {fmtAmount(row.original.userDeduction)}
            </span>
          </div>
        ),
      },
      {
        id: 'to',
        header: 'To (Wallet / Amount)',
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col leading-snug">
            <span
              className="max-w-[190px] truncate font-mono"
              title={row.original.receiverAccount}
            >
              {row.original.receiverAccount || '-'}
            </span>
            <span className="text-xs font-semibold text-[var(--ks-clearing,#0b6b53)]">
              {fmtAmount(row.original.receiverAmount)}
            </span>
          </div>
        ),
      },
      {
        id: 'userRate',
        header: 'FX Rate',
        cell: ({ row }) => (
          <span className="block text-right font-mono tabular-nums">
            {row.original.userRate == null
              ? '-'
              : Number(row.original.userRate).toFixed(4)}
          </span>
        ),
      },
      {
        id: 'lpName',
        header: 'LP',
        cell: ({ row }) => (
          <span className="block max-w-[140px] truncate" title={row.original.lpName}>
            {row.original.lpName || '-'}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <TransactionStatusBadge status={row.original.status} />,
      },
      {
        id: 'createTime',
        header: 'Creation Time',
        cell: ({ row }) => (
          <span className="tabular-nums">{formatTime(row.original.createTime)}</span>
        ),
      },
      {
        id: 'completedTime',
        header: 'Completion Time',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatTime(row.original.completedTime)}
          </span>
        ),
      },
      createActionColumn<TransactionRow & { id: string }>((item) => {
        // 处置入口仅 EXCEPTION(70) 行可见（后端「仅 70 可裁定」的 UI 投影）。
        const actions: TableRowAction<TransactionRow & { id: string }>[] = [
          { label: 'View', onClick: () => onView(item) },
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
        label: `${p.sourceTokenCode}→${p.targetTokenCode}`,
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
      {/* 页头（源 page-head：eyebrow + 标题） */}
      <div>
        <div className="text-xs text-muted-foreground">FX</div>
        <h1 className="text-xl font-semibold">FX Transactions</h1>
      </div>

      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              Transactions
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
            <FormSelect
              name="status"
              control={control}
              label="Status"
              options={statusSelectOptions}
              placeholder="All"
            />
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
            <div className="flex flex-wrap items-end gap-2">
              <Button type="submit">Search</Button>
              <Button type="button" variant="outline" onClick={onReset}>
                Reset
              </Button>
              <div className="flex h-10 items-center">
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => setShowMore((v) => !v)}
                >
                  {showMore ? 'Collapse Filters' : 'More Filters'}
                </Button>
              </div>
            </div>
          </div>

          {/* 更多筛选（会话态不持久化）：仅源/目标银行（裁决 6，不暴露 transactionId/txUuid） */}
          {showMore && (
            <div className="mt-3 grid grid-cols-1 gap-3 border-t border-border/50 pt-3 sm:grid-cols-2 lg:grid-cols-4">
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
              emptyMessage="No transactions found"
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

      {drawerTxId != null && (
        <TxDetailDrawer
          txId={drawerTxId}
          open
          onOpenChange={(o) => {
            if (!o) setDrawerTxId(null);
          }}
        />
      )}

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
