'use client';

/**
 * Transaction chain drawer (LP/03 B2 - page-internal piece of the tx-flow
 * list page; opens on a row entry action and renders one transaction's
 * transfer chain).
 *
 * v4 unified chain (2026-10-29): the BFF/api now returns the SAME assembled
 * shape as admin (TxChainAssembler: 6-stage axis + flat events, LP projection
 * sanitized server-side — titles from the unified copy table, operator/
 * remark/traceId stripped, self-loop requote events filtered). The drawer
 * renders a stage rail + event timeline and does NO client-side inference
 * (the v3 flatten/group/NODE_TITLES inference module is retired - it was the
 * drift source: dispose nodes swallowed, vouchers lost).
 *
 * Basic info / hero summary layout stays v2.3 (§6.3 layered grid, KSN txNo
 * hero, amounts at token precision via amountText).
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
  type AmountText,
  txDrawerVariant,
  txStatusLabel,
  txWarnClass,
  completedTimeText,
  type TimelineTone,
} from './tx-chain';
import { formatAmount, formatTime } from './format';
import { ServiceDownAlert } from './service-down-alert';

/* ================================================================== */
/* Unified chain rendering (v4)                                        */
/* ================================================================== */

/** Timeline dot tint per milestone tone; primary stays on the theme token. */
const TONE_DOT: Record<TimelineTone, string> = {
  success: 'bg-emerald-500',
  danger: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-muted-foreground',
  primary: 'bg-primary',
};

/** Event tone by landing status (UI concern; titles come from the server). */
function toneByStatusTo(to: number): TimelineTone {
  if (to === 35 || to === 40) return 'success';
  if (to === 70 || to === 90) return 'danger';
  if (to === 50) return 'warning';
  if (to === 60 || to === 80) return 'info';
  return 'primary';
}

/** Stage rail row state → visual class + label suffix. */
/**
 * Vertical single timeline from server events. Amount chips stay a local UI
 * concern (taken from the row payload, no second request): quote-lock carries
 * principal/target/rate, payout & completion carry the target amount.
 */
function buildItems(
  events: {
    flowId: number;
    eventTime: number;
    statusTo: number;
    title: string;
    csTxId: string;
    remark?: string;
}[],
  row: TxRow,
  amountText: AmountText,
): ChainItem[] {
  return events.map((e) => {
    const extras: string[] = [];
    if (e.statusTo === 5) {
      if (row.principal != null)
        extras.push(`Principal ${amountText(row.principal, row.sourceTokenNo)}`);
      if (row.receiverAmount != null)
        extras.push(`Target ${amountText(row.receiverAmount, row.targetTokenNo)}`);
      if (row.userRate != null) extras.push(`Rate ${row.userRate}`);
    }
    if ((e.statusTo === 30 || e.statusTo === 35 || e.statusTo === 40) && row.receiverAmount != null) {
      extras.push(`Target ${amountText(row.receiverAmount, row.targetTokenNo)}`);
    }
    if (e.csTxId) extras.push(`Ref ${e.csTxId}`);
    return {
      flowId: e.flowId,
      eventTime: e.eventTime,
      title: e.title,
      tone: toneByStatusTo(e.statusTo),
      extras,
      remark: e.remark,
    };
  });
}

function ChainTimeline({ items }: { items: ChainItem[] }) {
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
          <div className="mt-1 text-[13px] font-semibold leading-5 text-foreground">
            {e.title}
          </div>
          {e.remark ? (
            <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
              {e.remark}
            </p>
          ) : null}
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

function Amount({ text }: { text: string }) {
  return (
    <span className="font-mono text-sm font-medium tabular-nums">{text}</span>
  );
}

/**
 * §6.3 layered detail grid: amounts + copyable identifiers (core) above a
 * hairline, audit timestamps (muted, denser 3-col) below; failure reason
 * keeps its own full row. Tx No. / Status / Token Pair moved to the hero.
 */
function BasicInfo({
  row,
  amountText,
}: {
  row: TxRow;
  amountText: AmountText;
}) {
  return (
    <dl className="space-y-4">
      {/* 核心信息层：金额（Data 角色）+ 业务标识（Identifier，复制贴字段） */}
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <DescItem label="Principal">
          <Amount text={amountText(row.principal, row.sourceTokenNo)} />
        </DescItem>
        <DescItem label="User Deduction">
          {/* ed1a340: principal × (1 + markup) actually debited at the source */}
          <Amount text={amountText(row.userDeduction, row.sourceTokenNo)} />
        </DescItem>
        <DescItem label="Receiver Amount">
          <Amount text={amountText(row.receiverAmount, row.targetTokenNo)} />
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
  const { symOf, bankOf, decimalsOf } = useTokenMeta(LP_PROJECT_ID);

  /**
   * 金额口径（ed1a340/6a55188）：formatAmount 按对应 token 的 decimalDigits
   * 定小数位（HALF_UP 千分位），后缀币种缩写；text 为 '-' 时不追加缩写。
   */
  const amountText = React.useCallback<AmountText>(
    (v, tokenKey) => {
      const text = formatAmount(v, decimalsOf(tokenKey));
      return text === '-' ? text : `${text} ${symOf(tokenKey)}`;
    },
    [decimalsOf, symOf],
  );

  // v4: server-assembled stages + flat events; failed refetch keeps last
  // good data via the query cache.
  const timeline = React.useMemo(
    () => buildItems(chainQuery.data?.events ?? [], row, amountText),
    [chainQuery.data, row, amountText],
  );

  // 0024 -> banner inside the drawer; other failures clear the banner while
  // keeping previous data (global toast handled by lp-client).
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
                    {symOf(row.sourceTokenNo)}/
                    {symOf(row.targetTokenNo)}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">
                    {bankOf(row.sourceTokenNo)} →{' '}
                    {bankOf(row.targetTokenNo)}
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
                  <BasicInfo row={row} amountText={amountText} />
                </div>
              </section>

              {/* 统一链路（v4）：阶段轴（服务端 6 段）+ 事件时间线（服务端文案/凭证） */}
              <section className="rounded-lg border border-border/60 bg-card">
                <h4 className="border-b border-border/50 px-4 py-3 text-sm font-semibold text-foreground">
                  Transaction Chain
                </h4>
                <div className="space-y-5 px-4 py-4">
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
