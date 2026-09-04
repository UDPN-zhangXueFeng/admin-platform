'use client';

/**
 * Transaction chain drawer (LP/03 B2 - page-internal piece of the tx-flow
 * list page; opens on a row entry action and renders one transaction's
 * transfer chain).
 *
 * Behavior contract (doc 01 section D9 v3 + E traps, upstream 2026-09-04
 * 35ca014):
 * - Radix dialog drawer anchored right, width min(720px, 90vw); closes on
 *   ESC and on overlay click (built into the shared Drawer primitive;
 *   parent unmounts us through onClosed).
 * - Title "Transaction Details" (v2.3 rename); §6.3 layout: hero summary
 *   (copyable KSN txNo + token-pair identity + status badge) above the
 *   fixed 11-item set re-layered as core amounts and copyable business
 *   identifiers first, audit timestamps behind a hairline, conditional
 *   failure reason on its own full row; the old transaction ID item stays
 *   retired. Money items use the drawer caliber fmtAmount (2..8 fraction
 *   digits, en-US grouping), NOT the global formatMoney - both calibers
 *   must survive side by side.
 * - Token Pair renders the v2.3 slash compact form via useTokenMeta
 *   (symOf falls back to the raw token code).
 * - Status badge caliber: 35 renders success/"Completed" in the drawer
 *   AND on the list since 2026-09-04 (the old dual-caliber trap E14 is
 *   retired).
 * - Chain section v3 (single business timeline, admin-parity): milestones
 *   titled by landing status (NODE_TITLES), child nodes contribute voucher
 *   chips only; tone per landing status (35/40 green, 90/70 red, 50 amber,
 *   60/80 gray, rest brand via theme token); quote-lock and payout/
 *   completion milestones carry amount/rate chips. Empty state renders
 *   "No chain data" (no second empty tier - the per-stage event list is
 *   retired with the stage axis).
 * - Service-down downgrade banner branch kept inside the drawer; failed
 *   refetches keep previously loaded nodes.
 *
 * Inference tables live in ./tx-chain (pure module per LP/03 B2).
 */
import * as React from 'react';

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
  type TxRow,
} from '@myorg/modules/lp-portal/data-access';
import {
  buildChainTimeline,
  completedTimeText,
  flattenChain,
  fmtAmount,
  txDrawerVariant,
  txStatusLabel,
  txWarnClass,
  type TimelineItem,
  type TimelineTone,
} from './tx-chain';
import { formatTime } from './format';
import { ServiceDownAlert } from './service-down-alert';

/* ================================================================== */
/* Single business timeline (v3, doc 01 D9)                            */
/* ================================================================== */

/** Timeline dot tint per milestone tone; primary stays on the theme token. */
const TONE_DOT: Record<TimelineTone, string> = {
  success: 'bg-emerald-500',
  danger: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-muted-foreground',
  primary: 'bg-primary',
};

/**
 * Vertical single timeline: timestamp first (source el-timeline
 * placement=top), bold milestone title with the operator beside it,
 * amount / rate / voucher chips underneath.
 */
function ChainTimeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="relative ml-1 border-l border-border">
      {items.map((e) => (
        <li key={e.flowId} className="relative mb-5 ml-5 last:mb-0">
          <span
            aria-hidden="true"
            className={`absolute top-1 -left-[27px] h-2.5 w-2.5 rounded-full border-2 border-background ${TONE_DOT[e.tone]}`}
          />
          <div className="font-mono text-xs text-muted-foreground tabular-nums">
            {completedTimeText(e.eventTime)}
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <span className="text-[13px] font-semibold leading-5 text-foreground">
              {e.title}
            </span>
            {e.who && (
              <span className="text-xs text-muted-foreground">{e.who}</span>
            )}
          </div>
          {e.extras.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {e.extras.map((x, i) => (
                <span
                  key={`${e.flowId}-${i}`}
                  className="rounded-full bg-muted px-2 py-px font-mono text-xs leading-5 text-muted-foreground"
                >
                  {x}
                </span>
              ))}
            </div>
          )}
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

  // Single business timeline (v3): milestones from status-migration roots,
  // amount extras taken from the row payload (no second list request).
  const timeline = React.useMemo(
    () => buildChainTimeline(nodes, row),
    [nodes, row],
  );

  // 0024 -> banner inside the drawer; other failures clear the banner while
  // keeping previous nodes (global toast handled by lp-client).
  const err = chainQuery.error;
  const drawerDown = err != null && isServiceDown(err) ? err : null;

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

              {/* 运行信息：单时间轴业务里程碑（v3，阶段轴退役） */}
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
                  ) : timeline.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      No chain data
                    </div>
                  ) : (
                    <ChainTimeline items={timeline} />
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
