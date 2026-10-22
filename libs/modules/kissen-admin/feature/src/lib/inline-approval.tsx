'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Undo2,
  UserRound,
  XCircle,
} from 'lucide-react';

import {
  KISSEN_PROJECT_ID,
  useApprovalDetailByBusinessQuery,
  useApprovalPreviousStepMutation,
  useApprovalProcessMutation,
  useApprovalWithdrawMutation,
} from '@myorg/modules/kissen-admin/data-access';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
 * 行内审批（2026-10-22 P1，设计 §4.8）：审批动作在业务页就地完成，不跳审批中心。
 * 面板数据 detailByBusiness 三态；动作复用 process / previousStep / withdraw。
 * 2026-10-22 视觉改版：状态码→文案徽章、时间戳格式化、字段降噪、幽灵 tag 软胶囊。
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

/** businessContent 字段：中文名 + 展示顺序（未列出的排最后，内部 id 不展示）。 */
const CONTENT_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'bankName', label: 'Bank' },
  { key: 'bankBic', label: 'BIC' },
  { key: 'lpName', label: 'LP' },
  { key: 'tokenName', label: 'Token Name' },
  { key: 'tokenCode', label: 'Token' },
  { key: 'pairCode', label: 'Pair' },
  { key: 'instanceCode', label: 'Instance' },
  { key: 'sourceCurrency', label: 'Source Token' },
  { key: 'targetCurrency', label: 'Target Token' },
  { key: 'currentStatus', label: 'Current Status' },
  { key: 'targetStatus', label: 'Target Status' },
  { key: 'oldMinLiquidity', label: 'Current Min Liquidity' },
  { key: 'newMinLiquidity', label: 'New Min Liquidity' },
  { key: 'baseRate', label: 'Base Rate' },
  { key: 'markupRate', label: 'Markup Rate' },
  { key: 'defaultSplitRatio', label: 'Standard Rev. Share' },
  { key: 'slippageThreshold', label: 'Slippage Threshold' },
  { key: 'action', label: 'Action' },
  { key: 'pendingAction', label: 'Pending Action' },
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
  { key: 'createTime', label: 'Created on' },
];

/** 内部主键与冗余字段不展示（审批人不需要）。 */
const HIDDEN_KEYS: Record<string, true> = {
  bankId: true, tokenId: true, pairId: true, instanceId: true,
  keyId: true, orderId: true, lpId: true, id: true,
};

/** action 语义值 → 文案。 */
const ACTION_LABELS: Record<string, string> = {
  disable: 'Disable',
  enable: 'Enable',
  reset_key: 'Reset Down Key',
  revoke: 'Revoke',
  void: 'Void Order',
  stop: 'Deactivate',
  restore: 'Restore Draft',
};

/** 时间戳字段（epoch ms → UTC+8）。 */
const TIME_KEYS: Record<string, true> = { createTime: true, periodStart: true, periodEnd: true };

/** 指纹类字段（等宽 + 截断）。 */
const FINGERPRINT_KEYS: Record<string, true> = { downKeyFingerprint: true, keyFingerprint: true };

/** 状态徽章（currentStatus 用中性、targetStatus 用强调绿）。 */
function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: 'current' | 'target';
}) {
  return (
    <Badge
      variant={tone === 'target' ? 'default' : 'secondary'}
      className={
        tone === 'current'
          ? 'bg-muted/60 text-muted-foreground line-through'
          : 'bg-emerald-600 hover:bg-emerald-600'
      }
    >
      {label}
    </Badge>
  );
}

/** 单字段值渲染：状态→徽章、时间→格式化、指纹→等宽、其余文本。 */
function ContentValue({
  busCode,
  fieldKey,
  value,
}: {
  busCode: string;
  fieldKey: string;
  value: unknown;
}) {
  if (value === null || value === undefined || value === '') return <Dash />;
  if (fieldKey === 'action') {
    return <span>{ACTION_LABELS[String(value)] ?? String(value)}</span>;
  }
  const isStatus =
    fieldKey === 'currentStatus' ||
    fieldKey === 'targetStatus' ||
    fieldKey === 'status';
  if (isStatus) {
    const map = STATUS_MAP_BY_BUS[busCode];
    const label = map ? protoStatusLabel(map, Number(value)) : String(value);
    return (
      <StatusChip
        label={label}
        tone={fieldKey === 'targetStatus' ? 'target' : 'current'}
      />
    );
  }
  if ((fieldKey in TIME_KEYS)) {
    return (
      <span className="tabular-nums">{formatUtc8(Number(value))}</span>
    );
  }
  if ((fieldKey in FINGERPRINT_KEYS)) {
    return (
      <span className="font-mono text-xs break-all">{String(value)}</span>
    );
  }
  return <span>{String(value)}</span>;
}

export interface InlineApprovalPanelProps {
  busCode: string;
  busId: number;
  /** 处理完成（通过/驳回/退回/撤回）后回调，业务页刷新行数据。 */
  onHandled?: () => void;
}

/**
 * 行内审批面板：元信息 → 变更内容（状态对渲染为 旧徽章→新徽章）→ 意见 + 动作 → 结果态。
 * recordExists=false 渲染空态；动作成功后原地变结果态不自动关闭。
 */
export function InlineApprovalPanel({
  busCode,
  busId,
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
  const submitNode = history[0];

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
  const hasTargetPair = raw['targetStatus'] !== undefined;
  const ordered = [
    ...CONTENT_FIELDS.filter(
      (f) =>
        raw[f.key] !== undefined &&
        !(hasTargetPair && f.key === 'currentStatus'),
    ),
    ...Object.keys(raw)
      .filter((k) => !(k in HIDDEN_KEYS) && !CONTENT_FIELDS.some((f) => f.key === k))
      .map((k) => ({ key: k, label: k })),
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* 元信息：提交人 / 时间 / 步骤数 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {submitNode ? (
          <span className="inline-flex items-center gap-1">
            <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
            {submitNode.reviewerName}
          </span>
        ) : null}
        {submitNode?.reviewerTime ? (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            {formatUtc8(submitNode.reviewerTime)}
          </span>
        ) : null}
        <Badge variant="outline">{history.length} step(s)</Badge>
      </div>

      {/* 变更内容：状态对（current→target）渲染为徽章迁移，其余字段值格式化 */}
      <div className="rounded-lg border border-border/60">
        {ordered.length === 0 ? (
          <div className="px-4 py-3 text-sm text-muted-foreground">
            No business fields.
          </div>
        ) : (
          ordered.map(({ key, label }) => (
            <div
              key={key}
              className="flex items-center justify-between gap-4 border-b border-border/40 px-4 py-2 last:border-b-0"
            >
              <span className="shrink-0 text-xs text-muted-foreground">
                {label}
              </span>
              <div className="flex items-center gap-1.5">
                {key === 'targetStatus' && raw['currentStatus'] !== undefined ? (
                  <>
                    <ContentValue busCode={busCode} fieldKey="currentStatus" value={raw['currentStatus']} />
                    <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                  </>
                ) : null}
                <ContentValue busCode={busCode} fieldKey={key} value={raw[key]} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* 意见 + 动作（当前用户为待审节点审批人时展示） */}
      {canApprove || canPrevious || canWithdraw ? (
        <div className="flex flex-col gap-2">
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
        <div className="rounded-lg border border-dashed px-4 py-3 text-xs text-muted-foreground">
          Awaiting review — you are not the current step reviewer. You can track
          progress above.
        </div>
      )}
    </div>
  );
}

/** 在途意图幽灵 tag：琥珀软胶囊 + 呼吸点，点击打开行内审批弹窗。 */
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
      title={stepName ? `Under approval · ${stepName}` : 'Under approval'}
      onClick={onClick}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-amber-300/70 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20"
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
      </span>
      <span className="truncate">
        Under Approval
        {applyCode ? (
          <span className="ml-1 font-mono opacity-70">{applyCode}</span>
        ) : null}
      </span>
    </button>
  );
}

/** 行内审批入口按钮 + 弹窗（业务页动作列用；不跳路由）。 */
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Inline Approval</DialogTitle>
            <DialogDescription>
              Approve in place — business executes immediately on approval.
            </DialogDescription>
          </DialogHeader>
          <InlineApprovalPanel
            busCode={busCode}
            busId={busId}
            onHandled={() => onHandled?.()}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

/** 幽灵 tag + 弹窗组合（状态列用：点击 tag 查看进度/撤回/审批）。 */
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Approval In Progress</DialogTitle>
            <DialogDescription>
              Review the pending change and take action in place.
            </DialogDescription>
          </DialogHeader>
          <InlineApprovalPanel
            busCode={busCode}
            busId={busId}
            onHandled={() => onHandled?.()}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
