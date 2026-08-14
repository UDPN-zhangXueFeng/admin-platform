'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';

import {
  Badge,
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  RadioGroup,
  RadioGroupItem,
  Skeleton,
  Textarea,
  useToast,
} from '@myorg/shared/ui';
import { FormField, FormSelect } from '@myorg/shared/ui-forms';
import { useRouter } from '@myorg/shared/util-i18n';
import { cn } from '@myorg/shared/util-classnames';

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

/** 毫秒时间戳 → YYYY-MM-DD HH:mm:ss；0/null/undefined/非法 → '-'。 */
function formatTime(ms: number | null | undefined): string {
  if (!ms || !Number.isFinite(Number(ms))) return '-';
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return '-';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
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
  { code: 1, name: '已创建' },
  { code: 5, name: '已报价' },
  { code: 10, name: '已确认' },
  { code: 20, name: '源端划转中' },
  { code: 25, name: '源端已验证' },
  { code: 30, name: '解付中' },
  { code: 35, name: '已入账' },
  { code: 40, name: '已完成' },
];

/** 结算腿（钱真正移动的段）：结算金只允许出现在此语义。 */
const RAIL_SETTLE_CODES: Record<number, true> = { 25: true, 30: true, 35: true };

type RailTone = 'danger' | 'info';

/** 分支终态：forkCode 是离开主线前最后经过的主线节点（纯展示近似分叉位置）。 */
const RAIL_BRANCH: Record<number, { name: string; tone: RailTone; forkCode: number }> = {
  50: { name: '冲正中', tone: 'info', forkCode: 25 },
  60: { name: '已冲正', tone: 'info', forkCode: 25 },
  70: { name: '异常', tone: 'danger', forkCode: 30 },
  80: { name: '已取消', tone: 'info', forkCode: 10 },
  90: { name: '失败', tone: 'danger', forkCode: 20 },
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
  const ariaLabel = current ? `交易状态：${current.name}` : '交易状态未知';
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
  1: '报价',
  2: '确认',
  3: '源端划转',
  4: '源端验证',
  5: '垫资解付',
  6: '入账',
  7: '结算',
  8: '完成',
};

const STAGE_STATUS_LABEL: Record<number, string> = {
  1: '未开始',
  2: '进行中',
  3: '成功',
  4: '失败',
  5: '跳过',
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
const EVENT_TYPE_LABEL: Record<number, string> = { 2: '动作', 3: '报文', 4: '重试' };

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
  return s.status === 5 ? `${name}（跳过）` : name;
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
    return <p className="text-sm text-muted-foreground">暂无阶段数据</p>;
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
            ? `（${STAGE_STATUS_LABEL[currentStage.status] ?? currentStage.status}）`
            : ''}
        </div>
        {selectedEvents.length ? (
          <ul className="space-y-3">
            {selectedEvents.map((e) => (
              <li key={e.flowId} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {EVENT_TYPE_LABEL[e.nodeType] ?? `事件类型 ${e.nodeType}`}
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
                  操作人：{orDash(e.operator)}
                </div>
                <div className="text-xs text-muted-foreground">
                  货币系统交易 ID：{orDash(e.csTxId)}
                </div>
                {e.remark && (
                  <div className="text-xs text-muted-foreground">备注：{e.remark}</div>
                )}
                {e.traceId && (
                  <div className="text-xs text-muted-foreground">
                    traceId：{e.traceId}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">该阶段暂无事件明细</p>
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

/* ================================================================== */
/* 异常处置 Dialog（源 resolve-dialog.vue）                             */
/* ================================================================== */

const RESOLVE_ACTION_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '1', label: '完成' },
  { value: '2', label: '失败' },
  { value: '3', label: '冲正完成' },
];

const RESOLVE_SUCCESS_MSG: Record<string, string> = {
  1: '已标记交易完成',
  2: '已标记交易失败',
  3: '已完成冲正处置',
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
          toast.success(RESOLVE_SUCCESS_MSG[action] ?? '处置成功');
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
          <DialogTitle>交易异常处置</DialogTitle>
          <DialogDescription>仅异常（70）状态交易可裁定处置。</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 概要：与源 el-descriptions 一致 */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border p-3 text-sm">
            <DescField label="交易单号">{orDash(row?.txNo)}</DescField>
            <DescField label="交易 ID">{row?.transactionId ?? '-'}</DescField>
            <DescField label="货币对">
              {row ? pairText(row.sourceCurrency, row.targetCurrency) : '-'}
            </DescField>
            <DescField label="用户扣款">
              {row ? formatMoney(row.userDeduction) : '-'}
            </DescField>
          </div>

          {/* 处置方式（源 el-radio-group） */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              处置方式<span className="ml-0.5 text-destructive">*</span>
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
              完成：补记结算流水并发终态通知，交易置已完成
              <br />
              失败：交易置失败并记录失败原因
              <br />
              冲正完成：补开或完成冲正单，交易迁移至已冲正
            </p>
          </div>

          {/* 裁定原因（选填，入 flow 留痕） */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">裁定原因</label>
            <Textarea
              rows={3}
              maxLength={200}
              placeholder="选填，入 flow 留痕"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onSubmit} disabled={!action || submitting}>
            {submitting ? '提交中…' : '提交'}
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
        header: '交易单号',
        cell: ({ row }) => <span>{row.original.txNo || '-'}</span>,
      },
      {
        id: 'transactionId',
        header: '交易 ID',
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
        header: '货币对',
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
        header: '源银行→目标银行',
        cell: ({ row }) => (
          <span>
            {row.original.sourceBankName || '-'}→{row.original.targetBankName || '-'}
          </span>
        ),
      },
      {
        id: 'principal',
        header: '本金',
        cell: ({ row }) => <span>{formatMoney(row.original.principal)}</span>,
      },
      {
        id: 'userDeduction',
        header: '用户扣款',
        cell: ({ row }) => <span>{formatMoney(row.original.userDeduction)}</span>,
      },
      {
        id: 'status',
        header: '状态',
        cell: ({ row }) => <TransactionStatusBadge status={row.original.status} />,
      },
      {
        id: 'createTime',
        header: '创建时间',
        cell: ({ row }) => <span>{formatTime(row.original.createTime)}</span>,
      },
      {
        id: 'completedTime',
        header: '完成时间',
        cell: ({ row }) => <span>{formatTime(row.original.completedTime)}</span>,
      },
      {
        id: 'actions',
        header: '操作',
        cell: ({ row }) => {
          const item = row.original;
          // 处置入口仅 EXCEPTION(70) 行可见；冲正模式行恒为 50/60，不会出现。
          const canResolve = item.status === 70;
          return (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => onView(item.transactionId)}
              >
                查看
              </Button>
              {canResolve && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-destructive"
                  onClick={() => openResolve(item)}
                >
                  处置
                </Button>
              )}
            </div>
          );
        },
      },
    ];
  }, [onView, openResolve]);

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.transactionId) })),
    [rows],
  );

  // 下拉选项（首项「全部」哨兵；冲正模式状态仅 50/60）。
  const lpSelectOptions = React.useMemo(
    () => [
      { value: OPT_ALL, label: '全部' },
      ...(lpOptions ?? []).map((l) => ({
        value: String(l.lpId),
        label: `${l.lpName}(${l.lpCode})`,
      })),
    ],
    [lpOptions],
  );
  const pairSelectOptions = React.useMemo(
    () => [
      { value: OPT_ALL, label: '全部' },
      ...(pairOptions ?? []).map((p) => ({
        value: String(p.pairId),
        label: `${p.sourceCurrency}→${p.targetCurrency}`,
      })),
    ],
    [pairOptions],
  );
  const bankSelectOptions = React.useMemo(
    () => [
      { value: OPT_ALL, label: '全部' },
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
    return [{ value: OPT_ALL, label: '全部' }, ...TX_STATUS_OPTIONS];
  }, [mode]);

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="mb-4 text-sm font-semibold">筛选条件</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            name="txNo"
            label="交易单号"
            placeholder="精确匹配"
            maxLength={32}
            register={register('txNo')}
          />
          {mode !== 'exception' && (
            <FormSelect
              name="status"
              control={control}
              label="状态"
              options={statusSelectOptions}
              placeholder="全部"
            />
          )}
          <FormSelect
            name="lpId"
            control={control}
            label="LP"
            options={lpSelectOptions}
            placeholder="全部"
          />
          <FormSelect
            name="pairId"
            control={control}
            label="货币对"
            options={pairSelectOptions}
            placeholder="全部"
          />
          <FormField
            name="createTimeStart"
            label="创建开始时间"
            type="datetime-local"
            register={register('createTimeStart')}
          />
          <FormField
            name="createTimeEnd"
            label="创建结束时间"
            type="datetime-local"
            register={register('createTimeEnd')}
          />
        </div>

        {showMore && (
          <div className="mt-4 grid grid-cols-1 gap-4 border-t pt-4 md:grid-cols-2 xl:grid-cols-3">
            <FormField
              name="transactionId"
              label="交易 ID"
              placeholder="精确匹配"
              type="number"
              register={register('transactionId')}
            />
            <FormField
              name="txUuid"
              label="txUuid"
              placeholder="精确匹配"
              maxLength={64}
              register={register('txUuid')}
            />
            <FormSelect
              name="sourceBankId"
              control={control}
              label="源银行"
              options={bankSelectOptions}
              placeholder="全部"
            />
            <FormSelect
              name="targetBankId"
              control={control}
              label="目标银行"
              options={bankSelectOptions}
              placeholder="全部"
            />
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit">查询</Button>
          <Button type="button" variant="outline" onClick={onReset}>
            重置
          </Button>
          <Button
            type="button"
            variant="link"
            className="h-auto p-0"
            onClick={() => setShowMore((v) => !v)}
          >
            {showMore ? '收起筛选' : '更多筛选'}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-3">
          <div className="text-sm font-semibold">{title}</div>
        </div>
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          emptyMessage="暂无交易数据"
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
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">缺少交易 ID，无法查看详情。</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.back()}
        >
          返回
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">交易详情</h1>
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          返回
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
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground shadow-sm">
          暂无交易详情数据。
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
      <section className="space-y-3 rounded-lg border bg-card p-6 shadow-sm">
        <div className="text-xs font-medium tracking-wide text-muted-foreground">
          SETTLEMENT RAIL
        </div>
        <StatusRail status={detail.status} />
      </section>

      {/* 基本信息 */}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-4 text-sm font-semibold">基本信息</div>
        <DescGrid cols={2}>
          <DescField label="交易单号">{orDash(detail.txNo)}</DescField>
          <DescField label="交易 ID">{detail.transactionId}</DescField>
          <DescField label="txUuid">{orDash(detail.txUuid)}</DescField>
          <DescField label="货币对">
            {pairText(detail.sourceCurrency, detail.targetCurrency)}
          </DescField>
          <DescField label="LP">{orDash(detail.lpName)}</DescField>
          <DescField label="源银行">{orDash(detail.sourceBankName)}</DescField>
          <DescField label="目标银行">{orDash(detail.targetBankName)}</DescField>
          <DescField label="状态">
            <TransactionStatusBadge status={detail.status} />
          </DescField>
          <DescField label="创建时间">{formatTime(detail.createTime)}</DescField>
          <DescField label="完成时间">{formatTime(detail.completedTime)}</DescField>
        </DescGrid>
      </section>

      {/* 金额与汇率 */}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-4 text-sm font-semibold">金额与汇率</div>
        <DescGrid cols={2}>
          <DescField label="本金">{formatMoney(detail.principal)}</DescField>
          <DescField label="加价率">{orDash(detail.markupRate)}</DescField>
          <DescField label="用户扣款">{formatMoney(detail.userDeduction)}</DescField>
          <DescField label="基础汇率">{orDash(detail.baseRate)}</DescField>
          <DescField label="收款方到账">{formatMoney(detail.receiverAmount)}</DescField>
          <DescField label="用户汇率">{orDash(detail.userRate)}</DescField>
        </DescGrid>
      </section>

      {/* 账户 */}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-4 text-sm font-semibold">账户</div>
        <DescGrid cols={1}>
          <DescField label="付款账户">{orDash(detail.senderAccount)}</DescField>
          <DescField label="收款账户">{orDash(detail.receiverAccount)}</DescField>
          <DescField label="源端货币系统交易 ID">{orDash(detail.sourceCsTxId)}</DescField>
          <DescField label="目标端货币系统交易 ID">
            {orDash(detail.targetCsTxId)}
          </DescField>
        </DescGrid>
      </section>

      {/* 时间轴 */}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-4 text-sm font-semibold">时间轴</div>
        <DescGrid cols={2}>
          <DescField label="报价版本">{detail.quoteVersion}</DescField>
          <DescField label="报价过期时间">{formatTime(detail.quoteExpireTime)}</DescField>
          <DescField label="确认窗口过期">{formatTime(detail.confirmExpireTime)}</DescField>
          <DescField label="确认时间">{formatTime(detail.confirmTime)}</DescField>
          <DescField label="源端验证时间">{formatTime(detail.sourceVerifiedTime)}</DescField>
          <DescField label="解付时间">{formatTime(detail.advancingTime)}</DescField>
          <DescField label="入账时间">{formatTime(detail.settledTime)}</DescField>
          <DescField label="完成时间">{formatTime(detail.completedTime)}</DescField>
        </DescGrid>
      </section>

      {/* 失败原因 */}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-4 text-sm font-semibold">失败原因</div>
        <DescGrid cols={1}>
          <DescField label="失败原因">{orDash(detail.failReason)}</DescField>
          <DescField label="备注">{orDash(detail.remark)}</DescField>
        </DescGrid>
      </section>

      {/* 交易链路（8 阶段轴 + 事件流） */}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-4 text-sm font-semibold">交易链路</div>
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
  return <TransactionListCore mode="all" title="交易查询" detailModule="tx-list" />;
}

/** 交易查询详情。 */
export function TxListDetailPage() {
  return <TransactionDetailCore />;
}

/** 异常处理列表（status=70 过滤视图）。 */
export function TxExceptionListPage() {
  return (
    <TransactionListCore mode="exception" title="异常处理" detailModule="tx-exception" />
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
  return <TransactionListCore mode="reversal" title="冲正记录" detailModule="tx-list" />;
}
