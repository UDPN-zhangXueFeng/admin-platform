'use client';

import * as React from 'react';
import { toast } from 'sonner';

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

import { Dash, ProtoStatusBadge } from './proto-ui';

/**
 * 行内审批（2026-10-22 P1，设计 §4.8）：审批动作在业务页就地完成，不跳审批中心。
 * 面板数据 detailByBusiness 三态；动作复用 process / previousStep / withdraw。
 */

/** busCode → businessContent 字段中文名（detail 动态字段渲染，field-maps 同款职责）。 */
const CONTENT_LABELS: Record<string, string> = {
  bankName: 'Bank Name',
  bankBic: 'BIC',
  currentStatus: 'Current Status',
  targetStatus: 'Target Status',
  action: 'Action',
  sourceCurrency: 'Source Token',
  targetCurrency: 'Target Token',
  baseRate: 'Base Rate',
  markupRate: 'Markup Rate',
  defaultSplitRatio: 'Standard Rev. Share',
  slippageThreshold: 'Slippage Threshold',
  pendingAction: 'Pending Action',
  status: 'Status',
  tokenName: 'Token Name',
  oldMinLiquidity: 'Current Min Liquidity',
  newMinLiquidity: 'New Min Liquidity',
  pairCode: 'Pair',
  instanceCode: 'Instance',
  downKeyFingerprint: 'Down Key Fingerprint',
  keyFingerprint: 'Key Fingerprint',
  reason: 'Reason',
  lpName: 'LP',
  periodType: 'Period',
  periodStart: 'Period Start',
  periodEnd: 'Period End',
  txCount: 'Tx Count',
  principalTotal: 'Principal Total',
  markupTotal: 'Markup Total',
  orderId: 'Order ID',
  tokenId: 'Token ID',
  bankId: 'Bank ID',
  pairId: 'Pair ID',
  id: 'ID',
  instanceId: 'Instance ID',
  keyId: 'Key ID',
};

/** action 字段值 → 展示文案。 */
const ACTION_LABELS: Record<string, string> = {
  disable: 'Disable',
  enable: 'Enable',
  reset_key: 'Reset Down Key',
  revoke: 'Revoke',
  void: 'Void',
  stop: 'Deactivate',
  restore: 'Restore Draft',
};

/** 渲染 businessContent 单个字段值（数字状态码/action 转文案，其余 String）。 */
function contentValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'action') return ACTION_LABELS[String(value)] ?? String(value);
  return String(value);
}

/** 面板内单个字段行（diff 视觉：target/new 值绿色强调）。 */
function ContentRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-1.5 last:border-b-0">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium break-all">{value}</span>
    </div>
  );
}

export interface InlineApprovalPanelProps {
  busCode: string;
  busId: number;
  /** 处理完成（通过/驳回/退回/撤回）后回调，业务页刷新行数据。 */
  onHandled?: () => void;
}

/**
 * 行内审批面板：元信息 → 变更内容 diff → 意见 + 动作（approveButtonDTO 显隐）→ 结果态。
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
    tone: 'default' | 'destructive';
  } | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Loading approval…
      </div>
    );
  }
  if (isError) {
    return (
      <div className="py-8 text-center text-sm text-destructive">
        Failed to load approval detail.
      </div>
    );
  }
  if (!data || data.recordExists === false) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No approval record.
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
    mutation: { mutate: (vars: never, opts?: unknown) => void },
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
                ? 'Approved · business executed'
                : kind === 'reject'
                  ? 'Rejected'
                  : kind === 'back'
                    ? 'Returned to previous step'
                    : 'Withdrawn',
            tone: kind === 'approve' ? 'default' : 'destructive',
          });
          onHandled?.();
        },
        onError: (e: unknown) => toast.error((e as Error).message),
      } as never,
    );
  };

  if (done) {
    return (
      <div className="flex flex-col items-center gap-2 py-6">
        <ProtoStatusBadge tone={done.tone}>{done.label}</ProtoStatusBadge>
        <span className="text-xs text-muted-foreground">
          List will refresh shortly.
        </span>
      </div>
    );
  }

  const content = Object.entries(data.businessContent ?? {}).filter(
    ([key]) => CONTENT_LABELS[key] !== undefined,
  );

  return (
    <div className="flex flex-col gap-4">
      {/* 元信息行：提交人/时间 + 流转节点数 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {submitNode ? (
          <span>
            Submitted by <b>{submitNode.reviewerName}</b>
          </span>
        ) : null}
        {submitNode?.reviewerTime ? (
          <span>
            {new Date(submitNode.reviewerTime).toLocaleString()}
          </span>
        ) : null}
        <Badge variant="outline">{history.length} step(s)</Badge>
      </div>

      {/* 变更内容 */}
      <div>
        <div className="mb-1 text-xs font-semibold text-muted-foreground uppercase">
          Business Content
        </div>
        {content.length === 0 ? (
          <div className="py-2 text-sm text-muted-foreground">
            <Dash /> No business fields
          </div>
        ) : (
          content.map(([key, value]) => (
            <ContentRow
              key={key}
              label={CONTENT_LABELS[key]}
              value={
                key === 'targetStatus' || key === 'newMinLiquidity' ? (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {contentValue(key, value)}
                  </span>
                ) : key === 'oldMinLiquidity' || key === 'currentStatus' ? (
                  <span className="text-muted-foreground line-through">
                    {contentValue(key, value)}
                  </span>
                ) : (
                  contentValue(key, value)
                )
              }
            />
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
                  Reject
                </Button>
                <Button
                  size="sm"
                  disabled={processMutation.isPending}
                  onClick={() => act('approve', processMutation)}
                >
                  Approve &amp; Execute
                </Button>
              </>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          Awaiting review — you are not the current step reviewer.
        </div>
      )}
    </div>
  );
}

/** 在途意图幽灵 tag：虚线边框 + 单号 tooltip，点击打开行内审批弹窗。 */
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
    <Button
      variant="outline"
      size="sm"
      className="h-auto border-dashed px-1.5 py-0 text-[11px] font-normal text-amber-600 dark:text-amber-400"
      title={stepName ? `Under approval · ${stepName}` : 'Under approval'}
      onClick={onClick}
    >
      ┄ Under Approval{applyCode ? ` · ${applyCode}` : ''}
    </Button>
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
      <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setOpen(true)}>
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

/** 幽灵 tag + 弹窗组合（状态列用：点击 tag 查看进度/撤回）。 */
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
              Progress and actions of the pending change.
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
