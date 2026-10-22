'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  FileClock,
  Undo2,
  XCircle,
} from 'lucide-react';

import {
  BUSINESS_NAME_MAP,
  KISSEN_PROJECT_ID,
  useApprovalDetailByBusinessQuery,
  useApprovalPreviousStepMutation,
  useApprovalProcessMutation,
  useApprovalWithdrawMutation,
} from '@myorg/modules/kissen-admin/data-access';
import {
  Badge,
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  Textarea,
} from '@myorg/shared/ui';

import { Dash } from './proto-ui';
import {
  PROTO_BANK_STATUS,
  PROTO_INSTANCE_STATUS,
  PROTO_LP_PAIR_STATUS,
  PROTO_PAIR_STATUS,
  PROTO_SETTLE_ORDER_STATUS,
  PROTO_TOKEN_STATUS,
  protoStatusLabel,
  type ProtoStatusMeta,
} from './proto-enums';
import { formatUtc8 } from './proto-format';

/**
 * 行内审批（P1，设计 §4.8）：审批动作在业务页就地完成，不跳审批中心。
 * 2026-10-22 v4 抽屉重构：意图 Hero 卡（动作+实体+状态迁移，视觉主角）
 * + 审批流时间线 + 剩余字段紧凑两列 grid + 页级队列条逐条处理。
 */

/** busCode → 实体状态字典（status/currentStatus/targetStatus 翻译）。 */
const STATUS_MAP_BY_BUS: Record<string, Record<number, ProtoStatusMeta>> = {
  kissen_bank_toggle: PROTO_BANK_STATUS,
  kissen_token_toggle: PROTO_TOKEN_STATUS,
  kissen_token_param: PROTO_TOKEN_STATUS,
  kissen_pair_status: PROTO_PAIR_STATUS,
  kissen_pair_toggle: PROTO_PAIR_STATUS,
  kissen_gateway_toggle: PROTO_INSTANCE_STATUS,
  kissen_gateway_key_reset: PROTO_INSTANCE_STATUS,
  kissen_lp_pair_status: PROTO_LP_PAIR_STATUS,
  kissen_settle_void: PROTO_SETTLE_ORDER_STATUS,
};

/** action 语义值 → 文案（Hero 意图行）。 */
const ACTION_LABELS: Record<string, string> = {
  disable: 'Disable',
  enable: 'Enable',
  reset_key: 'Reset Down Key',
  revoke: 'Revoke',
  void: 'Void Order',
  stop: 'Deactivate',
  restore: 'Restore Draft',
};

/** 实体名字段（按优先级取第一个，Hero 用）。 */
const NAME_KEYS = [
  'bankName', 'lpName', 'tokenName', 'tokenCode', 'pairCode',
  'instanceCode', 'orderNo', 'orderCode',
];

/** Hero 已消费的字段（不再进 Details）。 */
const HERO_KEYS: Record<string, true> = {
  currentStatus: true, targetStatus: true, action: true, pendingAction: true,
  oldMinLiquidity: true, newMinLiquidity: true,
};

/** Details 字段：label + 顺序（Hero 消耗后的剩余字段；未列出排最后）。 */
const DETAIL_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'bankBic', label: 'BIC' },
  { key: 'sourceCurrency', label: 'Source Token' },
  { key: 'targetCurrency', label: 'Target Token' },
  { key: 'baseRate', label: 'Base Rate' },
  { key: 'markupRate', label: 'Markup Rate' },
  { key: 'defaultSplitRatio', label: 'Rev. Share' },
  { key: 'slippageThreshold', label: 'Slippage' },
  { key: 'status', label: 'Status' },
  { key: 'instanceCount', label: 'Instances' },
  { key: 'txCount', label: 'Transactions' },
  { key: 'principalTotal', label: 'Principal Total' },
  { key: 'markupTotal', label: 'Markup Total' },
  { key: 'periodStart', label: 'Period Start' },
  { key: 'periodEnd', label: 'Period End' },
  { key: 'reason', label: 'Reason' },
  { key: 'downKeyFingerprint', label: 'Down Key Fingerprint' },
  { key: 'keyFingerprint', label: 'Key Fingerprint' },
  { key: 'createTime', label: 'Submitted on' },
];

/** 内部主键不展示。 */
const HIDDEN_KEYS: Record<string, true> = {
  bankId: true, tokenId: true, pairId: true, instanceId: true,
  keyId: true, orderId: true, lpId: true, id: true,
};

/** 时间戳字段（epoch ms → UTC+8）。 */
const TIME_KEYS: Record<string, true> = { createTime: true, periodStart: true, periodEnd: true };

/** 指纹类字段（等宽 + 截断）。 */
const FINGERPRINT_KEYS: Record<string, true> = { downKeyFingerprint: true, keyFingerprint: true };

/** 分节标签（11px 大写字距）。 */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

/** 状态翻译（无字典兜底原值）。 */
function statusLabel(busCode: string, v: unknown): string {
  const map = STATUS_MAP_BY_BUS[busCode];
  return map ? protoStatusLabel(map, Number(v)) : String(v);
}

/* -------------------------------------------------------------- */
/* 意图 Hero 卡：动作 + 实体 + 变更迁移（审批人第一眼要看的）      */
/* -------------------------------------------------------------- */

function ApprovalHero({
  busCode,
  raw,
}: {
  busCode: string;
  raw: Record<string, unknown>;
}) {
  const entity = NAME_KEYS.map((k) => raw[k]).find(
    (v) => v !== undefined && v !== null && v !== '',
  );
  const actionRaw = raw['action'] ?? raw['pendingAction'];
  const actionText =
    typeof actionRaw === 'string'
      ? (ACTION_LABELS[actionRaw] ?? actionRaw)
      : undefined;

  // 迁移对：状态（current→target）或参数（old→new minLiquidity）
  let transition: { from: string; to: string; caption: string } | null = null;
  if (raw['targetStatus'] !== undefined && raw['currentStatus'] !== undefined) {
    transition = {
      from: statusLabel(busCode, raw['currentStatus']),
      to: statusLabel(busCode, raw['targetStatus']),
      caption: 'Status',
    };
  } else if (raw['newMinLiquidity'] !== undefined && raw['oldMinLiquidity'] !== undefined) {
    transition = {
      from: String(raw['oldMinLiquidity']),
      to: String(raw['newMinLiquidity']),
      caption: 'Min Liquidity',
    };
  }

  return (
    <div className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3.5 dark:border-amber-500/25 dark:bg-amber-500/10">
      {actionText ? (
        <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
          {actionText}
        </div>
      ) : null}
      {entity !== undefined ? (
        <div className="mt-0.5 truncate text-[15px] font-semibold leading-tight">
          {String(entity)}
        </div>
      ) : null}
      {transition ? (
        <div className="mt-3 flex items-center justify-center gap-3 rounded-lg bg-background/70 py-2.5">
          <Badge
            variant="secondary"
            className="bg-muted/70 text-[12px] font-normal text-muted-foreground"
          >
            {transition.from}
          </Badge>
          <ArrowRight
            className="h-3.5 w-3.5 text-muted-foreground"
            aria-hidden="true"
          />
          <Badge className="bg-emerald-600 text-[12px] font-medium text-white hover:bg-emerald-600">
            {transition.to}
          </Badge>
          <span className="sr-only">{transition.caption} change</span>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------- */
/* 审批流时间线：已完成节点 + 当前待审节点                        */
/* -------------------------------------------------------------- */

/** 节点结果码 → 文案/配色（后端约定：2 拒绝 / 3 通过 / 9 退回）。 */
const STEP_RESULT: Record<number, { label: string; cls: string }> = {
  3: { label: 'Passed', cls: 'text-emerald-600 dark:text-emerald-400' },
  2: { label: 'Rejected', cls: 'text-destructive' },
  9: { label: 'Returned', cls: 'text-amber-600 dark:text-amber-400' },
};

function FlowTimeline({
  history,
  currentStepName,
  awaitingYou,
}: {
  history: Array<{
    stepName: string;
    reviewerName: string;
    reviewerTime: number;
    reviewerRemarks: string;
    reviewerStatus: number;
  }>;
  currentStepName?: string;
  awaitingYou: boolean;
}) {
  return (
    <ol className="flex flex-col">
      {history.map((h) => {
        const r = STEP_RESULT[h.reviewerStatus];
        return (
          <li
            key={h.stepName + h.reviewerTime}
            className="relative flex gap-3 pb-4 last:pb-0"
          >
            <span
              className="absolute left-[9px] top-5 h-[calc(100%-14px)] w-px bg-border"
              aria-hidden="true"
            />
            <CheckCircle2
              className={`relative z-10 h-5 w-5 shrink-0 bg-background ${r?.cls ?? ''}`}
              aria-hidden="true"
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium leading-none">
                  {h.stepName}
                </span>
                <span className={`text-[11px] font-medium ${r?.cls ?? ''}`}>
                  {r?.label}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {h.reviewerName} · {formatUtc8(h.reviewerTime)}
              </div>
              {h.reviewerRemarks ? (
                <div className="rounded-md bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
                  “{h.reviewerRemarks}”
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
      <li className="relative flex gap-3">
        {history.length > 0 ? (
          <span
            className="absolute left-[9px] top-[-14px] h-[14px] w-px bg-border"
            aria-hidden="true"
          />
        ) : null}
        <span className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-amber-400/70 bg-background">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium leading-none">
              {currentStepName || 'Current step'}
            </span>
            <Badge
              variant="outline"
              className="h-4 border-amber-400/70 px-1.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"
            >
              Current
            </Badge>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {awaitingYou ? 'Awaiting your review' : 'Awaiting reviewer'}
          </div>
        </div>
      </li>
    </ol>
  );
}

/* -------------------------------------------------------------- */
/* Details 两列 grid：label 12 muted / value 13 medium            */
/* -------------------------------------------------------------- */

function DetailValue({
  busCode,
  fieldKey,
  value,
}: {
  busCode: string;
  fieldKey: string;
  value: unknown;
}) {
  if (value === null || value === undefined || value === '') return <Dash />;
  if (fieldKey === 'status') {
    return (
      <Badge
        variant="secondary"
        className="bg-muted/70 text-[11px] font-normal text-muted-foreground"
      >
        {statusLabel(busCode, value)}
      </Badge>
    );
  }
  if (fieldKey in TIME_KEYS) {
    return (
      <span className="text-[13px] font-medium tabular-nums">
        {formatUtc8(Number(value))}
      </span>
    );
  }
  if (fieldKey in FINGERPRINT_KEYS) {
    return (
      <span className="break-all font-mono text-[12px] font-medium">
        {String(value)}
      </span>
    );
  }
  return (
    <span className="text-[13px] font-medium">{String(value)}</span>
  );
}

export interface InlineApprovalPanelProps {
  busCode: string;
  busId: number;
  /** 当前待审节点名（行数据 listBrief 提供；队列/兜底流可缺省）。 */
  currentStepName?: string;
  /** 处理完成（通过/驳回/退回/撤回）后回调，业务页刷新行数据。 */
  onHandled?: () => void;
}

/**
 * 行内审批面板 v4：Hero（意图）→ Flow（时间线）→ Details（两列 grid）
 * → Remarks + 动作。动作成功后原地变结果态不自动关闭（队列模式由外层推进）。
 */
export function InlineApprovalPanel({
  busCode,
  busId,
  currentStepName,
  onHandled,
}: InlineApprovalPanelProps) {
  const { data, isLoading, isError } = useApprovalDetailByBusinessQuery(
    KISSEN_PROJECT_ID,
    busCode,
    busId,
  );
  const processMutation = useApprovalProcessMutation(KISSEN_PROJECT_ID);
  const previousStepMutation = useApprovalPreviousStepMutation(KISSEN_PROJECT_ID);
  const withdrawMutation = useApprovalWithdrawMutation(KISSEN_PROJECT_ID);

  const [remarks, setRemarks] = React.useState('');
  const [done, setDone] = React.useState<{
    label: string;
    ok: boolean;
  } | null>(null);

  // 切换单据时重置本地态（队列模式复用同一面板实例）
  React.useEffect(() => {
    setRemarks('');
    setDone(null);
  }, [busCode, busId]);

  if (isLoading) {
    return (
      <div className="space-y-3 py-2">
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-16 animate-pulse rounded bg-muted" />
        <div className="h-16 animate-pulse rounded bg-muted" />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-destructive">
        <XCircle className="h-4 w-4" aria-hidden="true" />
        Failed to load approval detail.
      </div>
    );
  }
  if (!data || data.recordExists === false) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        No approval record for this item.
      </div>
    );
  }

  const buttons = data.approveButtonDTO ?? {};
  const canApprove = buttons.approveType === 1;
  const canPrevious = buttons.previousStepType === 1;
  const canWithdraw = buttons.withdrawType === 1;
  const history = data.history ?? [];

  const act = (
    kind: 'approve' | 'reject' | 'back' | 'withdraw',
    mutation: { isPending: boolean; mutate: (vars: never, opts?: unknown) => void },
  ) => {
    if ((kind === 'reject' || kind === 'back') && !remarks.trim()) {
      toast.error('Remarks are required for rejection / return.');
      return;
    }
    mutation.mutate(
      {
        busCode,
        taskId: data.taskId,
        approve: kind === 'approve' ? 3 : 2,
        remarks: remarks.trim() || undefined,
      } as never,
      {
        onSuccess: () => {
          setDone({
            label:
              kind === 'approve'
                ? 'Approved — business executed'
                : kind === 'reject'
                  ? 'Rejected'
                  : kind === 'back'
                    ? 'Returned to previous step'
                    : 'Withdrawn',
            ok: kind === 'approve',
          });
          onHandled?.();
        },
        onError: (e: unknown) => toast.error((e as Error).message),
      } as never,
    );
  };

  if (done) {
    return (
      <div className="flex flex-col items-center gap-2 py-8">
        {done.ok ? (
          <CheckCircle2
            className="h-10 w-10 text-emerald-600 dark:text-emerald-400"
            aria-hidden="true"
          />
        ) : (
          <XCircle
            className="h-10 w-10 text-muted-foreground"
            aria-hidden="true"
          />
        )}
        <div className="text-sm font-semibold">{done.label}</div>
        <div className="text-xs text-muted-foreground">
          The list will refresh shortly.
        </div>
      </div>
    );
  }

  const raw = data.businessContent ?? {};
  const heroKeys: Record<string, true> = {
    ...HERO_KEYS,
    ...Object.fromEntries(NAME_KEYS.map((k) => [k, true])),
  };
  const detailRows = [
    ...DETAIL_FIELDS.filter((f) => raw[f.key] !== undefined),
    ...Object.keys(raw)
      .filter(
        (k) =>
          !(k in HIDDEN_KEYS) &&
          !(k in heroKeys) &&
          !DETAIL_FIELDS.some((f) => f.key === k),
      )
      .map((k) => ({ key: k, label: k })),
  ];

  return (
    <div className="flex flex-col gap-5">
      <ApprovalHero busCode={busCode} raw={raw} />

      <section className="flex flex-col gap-2">
        <SectionLabel>Flow</SectionLabel>
        <FlowTimeline
          history={history}
          currentStepName={currentStepName}
          awaitingYou={canApprove}
        />
      </section>

      {detailRows.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionLabel>Details</SectionLabel>
          <dl className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-2 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
            {detailRows.map(({ key, label }) => (
              <div key={key} className="col-span-2 grid grid-cols-subgrid">
                <dt className="self-center text-xs text-muted-foreground">
                  {label}
                </dt>
                <dd className="flex min-w-0 items-center justify-self-end text-right">
                  <DetailValue busCode={busCode} fieldKey={key} value={raw[key]} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {canApprove || canPrevious || canWithdraw ? (
        <div className="flex flex-col gap-2">
          <SectionLabel>Remarks</SectionLabel>
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="Remarks (required for reject / return)"
          />
          <div className="flex flex-wrap justify-end gap-2">
            {canWithdraw ? (
              <Button
                size="sm"
                variant="outline"
                disabled={withdrawMutation.isPending}
                onClick={() => act('withdraw', withdrawMutation)}
              >
                <Undo2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                Withdraw
              </Button>
            ) : null}
            {canPrevious ? (
              <Button
                size="sm"
                variant="outline"
                disabled={previousStepMutation.isPending}
                onClick={() => act('back', previousStepMutation)}
              >
                Return
              </Button>
            ) : null}
            {canApprove ? (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={processMutation.isPending}
                  onClick={() => act('reject', processMutation)}
                >
                  <XCircle className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={processMutation.isPending}
                  onClick={() => act('approve', processMutation)}
                >
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  Approve &amp; Execute
                </Button>
              </>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <SectionLabel>Remarks</SectionLabel>
          <div className="rounded-xl border border-dashed px-4 py-3 text-xs text-muted-foreground">
            Awaiting review — you are not the current step reviewer. You can
            track progress above.
          </div>
        </div>
      )}
    </div>
  );
}

/** 在途审批行内入口：小图标按钮（悬浮提示明示用途），点击打开右侧审批抽屉。 */
export function ApprovalPendingTag({
  applyCode,
  stepName,
  onClick,
}: {
  applyCode?: string;
  stepName?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={
        stepName
          ? `Pending approval at "${stepName}" — click to view the change and approve / reject`
          : 'Pending approval — click to view the change and approve / reject'
      }
      onClick={onClick}
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-300/80 bg-amber-50 text-amber-700 transition-all hover:scale-110 hover:border-amber-400 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
    >
      <FileClock className="h-3 w-3" aria-hidden="true" />
      <span className="sr-only">
        Review approval{applyCode ? ` ${applyCode}` : ''}
      </span>
    </button>
  );
}

/* -------------------------------------------------------------- */
/* 审批抽屉（统一头部：业务类型 + 单号 mono + 实体名）             */
/* -------------------------------------------------------------- */

export function ApprovalReviewDrawer({
  open,
  onOpenChange,
  busCode,
  busId,
  applyCode,
  entityLabel,
  stepName,
  queueIndex,
  queueTotal,
  onHandled,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  busCode: string;
  busId: number;
  applyCode?: string;
  entityLabel?: string;
  stepName?: string;
  queueIndex?: number;
  queueTotal?: number;
  onHandled?: () => void;
}) {
  const typeName = BUSINESS_NAME_MAP[busCode] ?? busCode;
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="w-[520px] max-w-none sm:max-w-[520px]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="flex items-center gap-2 text-[15px]">
            <FileClock className="h-4 w-4 text-amber-600" aria-hidden="true" />
            {queueTotal !== undefined && queueIndex !== undefined
              ? `Review ${queueIndex + 1} / ${queueTotal}`
              : typeName}
          </DrawerTitle>
          <DrawerDescription className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {queueTotal !== undefined && queueIndex !== undefined ? (
              <span>{typeName}</span>
            ) : null}
            {applyCode ? (
              <span className="font-mono text-[11px]">{applyCode}</span>
            ) : null}
            {entityLabel ? <span>· {entityLabel}</span> : null}
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-6">
          <InlineApprovalPanel
            busCode={busCode}
            busId={busId}
            currentStepName={stepName}
            onHandled={() => onHandled?.()}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** 行内入口 + 审批抽屉（状态列用；表格上下文保持可见）。 */
export function ApprovalPendingTagWithDialog({
  busCode,
  busId,
  applyCode,
  stepName,
  onHandled,
}: {
  busCode: string;
  busId: number;
  applyCode?: string;
  stepName?: string;
  onHandled?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <ApprovalPendingTag
        applyCode={applyCode}
        stepName={stepName}
        onClick={() => setOpen(true)}
      />
      <ApprovalReviewDrawer
        open={open}
        onOpenChange={setOpen}
        busCode={busCode}
        busId={busId}
        applyCode={applyCode}
        stepName={stepName}
        onHandled={onHandled}
      />
    </>
  );
}

/** 行内审批入口按钮 + 抽屉（业务页动作列用；不跳路由）。 */
export function InlineApprovalButton({
  busCode,
  busId,
  onHandled,
  label = 'Review',
}: InlineApprovalPanelProps & { label?: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button
        variant="link"
        size="sm"
        className="h-auto p-0"
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <ApprovalReviewDrawer
        open={open}
        onOpenChange={setOpen}
        busCode={busCode}
        busId={busId}
        onHandled={onHandled}
      />
    </>
  );
}

/* -------------------------------------------------------------- */
/* 页级审批队列：本页待我审的单聚合为横条，逐条处理清空            */
/* -------------------------------------------------------------- */

export interface ApprovalQueueItem {
  busCode: string;
  busId: number;
  /** 队列条与抽屉标题里显示的实体名（如银行名/交易对）。 */
  label: string;
  /** 当前待审节点名（行数据 listBrief 提供，可缺省）。 */
  stepName?: string;
  /** 单号（抽屉头部 mono 显示）。 */
  applyCode?: string;
}

/**
 * 页级审批队列条 + 逐条抽屉：
 * - 本页存在待我审的单时，表格上方渲染琥珀横条 `N awaiting your review → Review`；
 * - 点 Review 打开右侧抽屉逐条审批，处理完自动跳下一条，清零后横条消失；
 * - 行内小图标入口保留为兜底。
 */
export function ApprovalQueue({
  items,
  onHandled,
}: {
  items: ApprovalQueueItem[];
  onHandled?: () => void;
}) {
  const visible = items.length > 0;
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);

  // 队列缩短（审批生效、列表刷新）时收敛游标
  React.useEffect(() => {
    if (index >= items.length) setIndex(0);
  }, [items.length, index]);

  if (!visible) return null;
  const current = items[Math.min(index, items.length - 1)];
  const advance = () => {
    onHandled?.();
    if (index + 1 < items.length) {
      setIndex(index + 1);
    } else {
      setOpen(false);
      setIndex(0);
    }
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        <span className="inline-flex items-center gap-2">
          <FileClock className="h-4 w-4" aria-hidden="true" />
          <span>
            <b className="tabular-nums">{items.length}</b> item
            {items.length > 1 ? 's' : ''} awaiting your review on this page
          </span>
        </span>
        <Button
          size="sm"
          className="h-7 gap-1 bg-amber-600 text-white hover:bg-amber-700"
          onClick={() => {
            setIndex(0);
            setOpen(true);
          }}
        >
          Review
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
      <ApprovalReviewDrawer
        open={open}
        onOpenChange={setOpen}
        busCode={current.busCode}
        busId={current.busId}
        applyCode={current.applyCode}
        entityLabel={current.label}
        stepName={current.stepName}
        queueIndex={index}
        queueTotal={items.length}
        onHandled={advance}
      />
    </>
  );
}
