'use client';

/**
 * Transaction chain drawer (LP/03 B2 - page-internal piece of the tx-flow
 * list page; opens on a row entry action and renders one transaction's
 * transfer chain).
 *
 * Behavior contract (doc 01 section D9 + E traps):
 * - Radix dialog drawer anchored right, width min(720px, 90vw); closes on
 *   ESC and on overlay click (built into the shared Drawer primitive;
 *   parent unmounts us through onClosed).
 * - Title "Transaction Details" (v2.3 rename); §6.3 layout: hero summary
 *   (copyable KSN txNo + token-pair identity + drawer-caliber status
 *   badge) above the fixed 11-item set re-layered as core amounts and
 *   copyable business identifiers first, audit timestamps behind a
 *   hairline, conditional failure reason on its own full row; the old
 *   transaction ID item stays retired. Money items use the drawer caliber
 *   fmtAmount (2..8 fraction digits, en-US grouping), NOT the global
 *   formatMoney - both calibers must survive side by side.
 * - Token Pair renders the v2.3 slash compact form via useTokenMeta
 *   (symOf falls back to the raw token code).
 * - Stage status uses the DRAWER status caliber (code 35 reads as success),
 *   which intentionally differs from the LIST caliber rendered on the page.
 * - Fixed 8-slot vertical stepper (no third-party step package): dot colors
 *   follow stage status (wait gray / progress pulse / success / danger /
 *   skipped gray) plus "(Skipped)" title suffix; start/end timestamps shown
 *   under each slot; zero times render '-'.
 * - Event timeline of the selected stage sorted by eventTime asc then
 *   flowId asc; nodeType label badge (message tier tinted as success),
 *   optional from->to status transition, operator / csTxId subtexts.
 * - Service-down downgrade banner branch kept inside the drawer; failed
 *   refetches keep previously loaded nodes.
 *
 * Inference tables live in ./tx-chain (pure module per LP/03 B2).
 */
import * as React from 'react';
import { Check, LoaderCircle, Minus, X } from 'lucide-react';

import {
  Badge,
  CopyableEllipsisText,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@myorg/shared/ui';

import {
  LP_PROJECT_ID,
  isServiceDown,
  useTokenMeta,
  useTxFlowChainQuery,
  type TxChainNode,
  type TxRow,
} from '@myorg/modules/lp-portal/data-access';
import {
  EVENT_TYPE_MAP,
  STAGE_STATUS_MAP,
  STAGE_STEP_MAP,
  buildStageList,
  completedTimeText,
  flattenChain,
  fmtAmount,
  hasTransit,
  pickInitialStep,
  transitText,
  txDrawerVariant,
  txStatusLabel,
  txWarnClass,
  type StageItem,
} from './tx-chain';
import { formatTime } from './format';
import { ServiceDownAlert } from './service-down-alert';

/* ================================================================== */
/* Stage stepper visuals                                               */
/* ================================================================== */

/** Icon inside the step dot for each inferred stage status. */
function StageIcon({ status }: { status: number }) {
  if (status === 3)
    return <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />;
  if (status === 4)
    return <X className="h-4 w-4 text-red-600" aria-hidden="true" />;
  if (status === 2)
    return (
      <LoaderCircle
        className="h-4 w-4 motion-safe:animate-spin text-primary"
        aria-hidden="true"
      />
    );
  // 1 not started / 5 skipped
  return <Minus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
}

/** Connector line tint between slots: crossed stages green, failed red, rest gray. */
function connectorClass(status: number): string {
  if (status === 3 || status === 5) return 'bg-emerald-500';
  if (status === 4) return 'bg-red-500';
  return 'bg-border';
}

/**
 * Vertical stepper (LP/03 B2): left rail of dots + connectors, selectable
 * rows carrying title and start/end timestamps on the right.
 */
function StageAxis({
  stages,
  selectedStep,
  onSelect,
}: {
  stages: StageItem[];
  selectedStep: number;
  onSelect: (step: number) => void;
}) {
  return (
    <ol className="flex flex-col">
      {stages.map((s, i) => {
        const selected = s.step === selectedStep;
        const name = STAGE_STEP_MAP[s.step] ?? `${s.step}`;
        const title = s.status === 5 ? `${name} (Skipped)` : name;
        const last = i === stages.length - 1;
        return (
          <li key={s.step}>
            <button
              type="button"
              onClick={() => onSelect(s.step)}
              aria-current={selected ? 'step' : undefined}
              className="group flex w-full cursor-pointer items-stretch gap-3 rounded px-1 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {/* Left rail: dot + downward connector to the next slot */}
              <span className="flex w-7 shrink-0 flex-col items-center">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-background">
                  <StageIcon status={s.status} />
                </span>
                {!last && (
                  <span
                    aria-hidden="true"
                    className={`w-0.5 flex-1 rounded ${connectorClass(s.status)}`}
                  />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-sm leading-5 ${
                    selected
                      ? 'font-semibold text-foreground underline'
                      : 'text-foreground/80 group-hover:text-foreground'
                  }`}
                >
                  {title}
                </span>
                <span className="mt-0.5 block font-mono text-xs leading-5 text-muted-foreground tabular-nums">
                  {completedTimeText(s.startTime)}
                  {' '}
                  to {completedTimeText(s.endTime)}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/* ================================================================== */
/* Event timeline                                                      */
/* ================================================================== */

function EventTimeline({ events }: { events: TxChainNode[] }) {
  return (
    <ol className="relative ml-3 border-l border-border">
      {events.map((e) => (
        <li key={e.flowId} className="relative mb-5 ml-5 last:mb-0">
          <span
            aria-hidden="true"
            className="absolute top-1 -left-[27px] h-2.5 w-2.5 rounded-full border-2 border-background bg-primary"
          />
          {/* Timestamp first (source el-timeline-item placement=top) */}
          <div className="font-mono text-xs text-muted-foreground tabular-nums">
            {completedTimeText(e.eventTime)}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={
                e.nodeType === 3
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : undefined
              }
            >
              {EVENT_TYPE_MAP[e.nodeType] ?? `Event type ${e.nodeType}`}
            </Badge>
            {hasTransit(e) && (
              <span className="font-mono text-[13px] text-muted-foreground">
                {transitText(e)}
              </span>
            )}
          </div>
          <div className="text-xs leading-5 text-muted-foreground">
            Operator: {e.operator || '-'}
          </div>
          <div className="text-xs leading-5 text-muted-foreground">
            Currency System Tx ID:{' '}
            <span className="font-mono">{e.csTxId || '-'}</span>
          </div>
          <div className="text-xs leading-5 text-muted-foreground">
            Remark: {e.remark || '-'}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ================================================================== */
/* Basic information                                                   */
/* ================================================================== */

function DescItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 min-w-0 break-all text-sm">{children}</dd>
    </div>
  );
}

/** Money cell in the drawer caliber (doc 01 E4), distinct from formatMoney. */
function Amount({ v }: { v: string | number | null | undefined }) {
  return (
    <span className="font-mono text-sm font-medium tabular-nums">
      {fmtAmount(v)}
    </span>
  );
}

/**
 * §6.3 layered detail grid: amounts + copyable identifiers (core) above a
 * hairline, audit timestamps (muted, denser 3-col) below; failure reason
 * keeps its own full row. Tx No. / Status / Token Pair moved to the hero.
 */
function BasicInfo({ row }: { row: TxRow }) {
  return (
    <dl className="space-y-4">
      {/* 核心信息层：金额（Data 角色）+ 业务标识（Identifier，复制贴字段） */}
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <DescItem label="Principal">
          <Amount v={row.principal} />
        </DescItem>
        <DescItem label="Receiver Amount">
          <Amount v={row.receiverAmount} />
        </DescItem>
        <DescItem label="Bank Idempotency No.">
          <CopyableEllipsisText
            value={row.txUuid || ''}
            emptyText="-"
            maxWidth={280}
            className="font-mono text-xs"
          />
        </DescItem>
        <DescItem label="Source Voucher No.">
          <CopyableEllipsisText
            value={row.sourceCsTxId || ''}
            emptyText="-"
            maxWidth={280}
            className="font-mono text-xs"
          />
        </DescItem>
      </div>
      {/* 审计信息层：时间戳弱化（Supporting），hairline 与核心层分隔 */}
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 border-t border-border/50 pt-4 sm:grid-cols-3">
        <DescItem label="Quote Time">
          {/* !quoteTime covers 0/undefined -> '-' (source caliber) */}
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {!row.quoteTime ? '-' : formatTime(row.quoteTime)}
          </span>
        </DescItem>
        <DescItem label="Completed At">
          {/* Strict === 0 unfinished sentinel, never routed through formatTime */}
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {completedTimeText(row.completedTime)}
          </span>
        </DescItem>
        <DescItem label="Data Time">
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {row.syncTime == null || row.syncTime === 0
              ? '-'
              : formatTime(row.syncTime)}
          </span>
        </DescItem>
      </div>
      {/* 长文本单独占行（§6.3） */}
      {Boolean(row.failReason) && (
        <div className="border-t border-border/50 pt-4">
          <DescItem label="Failure Reason">
            <span className="text-sm text-destructive">{row.failReason}</span>
          </DescItem>
        </div>
      )}
    </dl>
  );
}

/* ================================================================== */
/* Drawer shell                                                        */
/* ================================================================== */

export interface ChainDrawerProps {
  /** Row payload for the basic info panel (no second list request). */
  row: TxRow;
  /** Close callback; parent clears its row state to unmount the drawer. */
  onClosed: () => void;
}

export function ChainDrawer({ row, onClosed }: ChainDrawerProps) {
  const chainQuery = useTxFlowChainQuery(LP_PROJECT_ID, row.transactionId);

  // §6.3 hero identity: token-pair slash compact form via unified meta
  // (v2.3; symOf/bankOf fall back to the raw code).
  const { symOf, bankOf } = useTokenMeta(LP_PROJECT_ID);

  // Flattened nodes (flat array or tree both accepted; failed refetch keeps
  // last good data via the query cache).
  const nodes = React.useMemo(
    () => flattenChain(chainQuery.data),
    [chainQuery.data],
  );
  const stageList = React.useMemo(
    () => buildStageList(nodes, row.status),
    [nodes, row.status],
  );

  // Currently selected stage drives the event filter; re-derived after every
  // successful load (mirrors initSelectedStep-on-loadChain-success ordering).
  const [selectedStep, setSelectedStep] = React.useState(() =>
    pickInitialStep(buildStageList(flattenChain(chainQuery.data), row.status), flattenChain(chainQuery.data)),
  );
  React.useEffect(() => {
    setSelectedStep(pickInitialStep(stageList, nodes));
  }, [stageList, nodes]);

  // 0024 -> banner inside the drawer; other failures clear the banner while
  // keeping previous nodes (global toast handled by lp-client).
  const err = chainQuery.error;
  const drawerDown = err != null && isServiceDown(err) ? err : null;

  const currentStageStatus =
    stageList.find((s) => s.step === selectedStep)?.status ?? 1;

  // Selected-stage events: eventTime ascending, flowId ascending on ties.
  const selectedEvents = React.useMemo(
    () =>
      nodes
        .filter((n) => n.step === selectedStep)
        .sort((a, b) => a.eventTime - b.eventTime || a.flowId - b.flowId),
    [nodes, selectedStep],
  );

  return (
    <Drawer open onOpenChange={(o) => !o && onClosed()}>
      {/* Width pinned to min(720px, 90vw) per doc D9 */}
      <DrawerContent className="w-[min(720px,90vw)] max-w-none p-0">
        <div className="flex h-full flex-col">
          <DrawerHeader className="border-b px-6 py-4">
            <DrawerTitle>Transaction Details</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-5">
              {drawerDown && (
                <ServiceDownAlert traceId={drawerDown.traceId} />
              )}

              {/* §6.3 Hero Summary：KSN 单号（复制贴字段）+ Token 对标识 + 状态 */}
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">Tx No.</div>
                  <div className="mt-1">
                    {/* Fixed v2.3 caliber: txNo only, '-' fallback; empty
                        values are not copyable */}
                    <CopyableEllipsisText
                      value={row.txNo || ''}
                      emptyText="-"
                      maxWidth={340}
                      className="font-mono text-base font-semibold leading-6"
                    />
                  </div>
                  <div className="mt-2 font-mono text-[13px] font-semibold leading-5">
                    {symOf(row.sourceTokenCode)}/
                    {symOf(row.targetTokenCode)}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">
                    {bankOf(row.sourceTokenCode)} →{' '}
                    {bankOf(row.targetTokenCode)}
                  </div>
                </div>
                <Badge
                  variant={txDrawerVariant(row.status)}
                  className={txWarnClass(row.status)}
                >
                  {txStatusLabel(row.status)}
                </Badge>
              </div>

              {/* 核心信息 + 审计信息（§6.3 分层；panel 公式与列表批一致） */}
              <section className="rounded-lg border border-border/60 bg-card">
                <h4 className="border-b border-border/50 px-4 py-3 text-sm font-semibold text-foreground">
                  Basic Information
                </h4>
                <div className="px-4 py-4">
                  <BasicInfo row={row} />
                </div>
              </section>

              {/* 运行信息：stage 轴 + 事件时间线 */}
              <section className="rounded-lg border border-border/60 bg-card">
                <h4 className="border-b border-border/50 px-4 py-3 text-sm font-semibold text-foreground">
                  Transaction Chain
                </h4>
                <div className="px-4 py-4">
                  {chainQuery.isPending ? (
                    <div className="space-y-2" aria-label="Loading">
                      <div className="h-8 w-full motion-safe:animate-pulse rounded bg-muted" />
                      <div className="h-24 w-full motion-safe:animate-pulse rounded bg-muted" />
                    </div>
                  ) : nodes.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      No stage data
                    </div>
                  ) : (
                    <>
                      <StageAxis
                        stages={stageList}
                        selectedStep={selectedStep}
                        onSelect={setSelectedStep}
                      />
                      <div className="mt-4 mb-3 text-sm font-semibold">
                        {STAGE_STEP_MAP[selectedStep] ?? selectedStep}
                        {' - '}
                        {STAGE_STATUS_MAP[currentStageStatus] ??
                          currentStageStatus}
                      </div>
                      {selectedEvents.length > 0 ? (
                        <EventTimeline events={selectedEvents} />
                      ) : (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          No event details for this stage
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
