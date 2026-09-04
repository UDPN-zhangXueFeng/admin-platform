'use client';

/**
 * Transaction chain pure helpers (LP/03 B2 - private feature module).
 *
 * All timeline inference / flattening / status-caliber tables live here as
 * pure functions so they stay unit-testable in isolation; UI components
 * consume their results only. Semantics are translated 1:1 from doc 01
 * section D9 (v3, upstream 2026-09-04 35ca014) and legacy
 * `src/views/tx-flow/chain-drawer.vue`:
 *
 * - flattenChain: chain response may arrive as a node tree (with children)
 *   or a flat array; nodes inherit the parent step when their own step<=0.
 * - buildChainTimeline: single business timeline - status-migration root
 *   nodes become milestones titled by their landing status; action/message
 *   child nodes fold into the previous milestone contributing only their
 *   csTxId voucher chips (desensitized remarks carry no information).
 * - Status calibers (doc 01 E14, revised 2026-09-04 aad34fa): 35 is a
 *   success terminal ("Completed") in BOTH list and drawer - the former
 *   list-primary caliber is retired. Unknown codes fall back to a neutral
 *   secondary badge showing the raw number - never throws.
 *
 * Display copy and comments are English-only (hard constraint).
 */
import {
  TX_STATUS_LABEL,
  TX_STATUS_VARIANT,
  TX_STATUS_WARN_CLASS,
} from '@myorg/modules/lp-portal/data-access';
import type { TxChainNode, TxRow } from '@myorg/modules/lp-portal/data-access';

import { formatTime } from './format';

/* ================================================================== */
/* Status badge calibers                                               */
/* ================================================================== */

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline';

/**
 * LIST caliber (doc 01 D9/E14, checked state by state; 2026-09-04 aad34fa
 * promotes 35 from in-flight primary to success):
 * 35|40 success -> default; 50 warning -> outline + amber stroke;
 * 60/80 info -> outline; 70/90 danger -> destructive;
 * everything else stays in-flight primary -> secondary. Unknown codes land
 * in the same neutral fallback.
 */
export function txListVariant(status: number): BadgeVariant {
  if (status === 35 || status === 40) return 'default';
  if (status === 70 || status === 90) return 'destructive';
  if (status === 50 || status === 60 || status === 80) return 'outline';
  return 'secondary';
}

/** Amber stroke overlay for the single warning-tier code 50 (reversing). */
export function txWarnClass(status: number): string | undefined {
  return status === 50 ? TX_STATUS_WARN_CLASS : undefined;
}

/**
 * DRAWER caliber reuses the domain table; since 2026-09-04 both calibers
 * agree on every code (35|40 success). Kept as a named seam so a future
 * drawer-only tone never leaks into the list again. Unknown codes share
 * the list fallback: secondary badge + raw number.
 */
export function txDrawerVariant(status: number): BadgeVariant {
  return TX_STATUS_VARIANT[status] ?? txListVariant(status);
}

/** Status label with raw-number fallback so unknown codes never crash. */
export function txStatusLabel(status: number): string {
  return TX_STATUS_LABEL[status] ?? `${status}`;
}

/* ================================================================== */
/* Money/time calibers                                                 */
/* ================================================================== */

/**
 * Drawer money caliber (doc 01 E4): en-US grouping that keeps 2..8 fraction
 * digits (`toLocaleString('en-US', {min 2, max 8})`) - deliberately NOT the
 * global `formatMoney` which preserves backend digits verbatim. Non-finite,
 * empty or null input renders '-'; numeric strings are accepted.
 */
export function fmtAmount(v: number | string | null | undefined): string {
  if (
    v === null ||
    v === undefined ||
    v === '' ||
    !Number.isFinite(Number(v))
  )
    return '-';
  return Number(v).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
}

/**
 * Rate caliber (doc 01 E31, shared with the list FX Rate cell): 0 / missing
 * / non-numeric renders '-' (0 = no deal snapshot, not a free trade); other
 * values get en-US grouping with up to 8 fraction digits (trailing zeros
 * trimmed).
 */
export function fmtRate(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '-';
  const n = Number(v);
  if (Number.isNaN(n) || n === 0) return '-';
  return n.toLocaleString('en-US', { maximumFractionDigits: 8 });
}

export function completedTimeText(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '-';
  return ms === 0 ? '-' : formatTime(ms);
}

/* ================================================================== */
/* Flatten + single business timeline (doc 01 D9 v3, 2026-09-04)       */
/* ================================================================== */

/**
 * Milestone titles keyed by the landing status of a status-migration root
 * node (copy aligned with the desensitized kissen-api wording). Unknown
 * landing codes fall back to "Status updated".
 */
export const NODE_TITLES: Record<number, string> = {
  1: 'Transaction created',
  5: 'Quote locked',
  10: 'Payment confirmed',
  20: 'Waiting for source arrival',
  25: 'Source arrival confirmed',
  30: 'Payout processing',
  35: 'Transaction completed — funds credited',
  40: 'Transaction completed — funds credited',
  50: 'Reversal in progress',
  60: 'Funds returned',
  70: 'Platform processing',
  80: 'Transaction cancelled',
  90: 'Transaction failed',
};

/** Timeline dot tone: done green / failed red / reversing amber / cancelled gray / rest brand. */
export type TimelineTone =
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'primary';

/** One rendered milestone on the single chain timeline. */
export interface TimelineItem {
  /** First-seen flowId of the group (React key). */
  flowId: number;
  eventTime: number;
  title: string;
  /** Operator shown beside the title (empty string hides it). */
  who: string;
  tone: TimelineTone;
  /** Amount/rate/voucher chips rendered under the title. */
  extras: string[];
}

/** Tone per landing status (35/40 green, 90/70 red, 50 amber, 60/80 gray). */
export function nodeTone(to: number): TimelineTone {
  if (to === 35 || to === 40) return 'success';
  if (to === 90 || to === 70) return 'danger';
  if (to === 50) return 'warning';
  if (to === 60 || to === 80) return 'info';
  return 'primary';
}

/**
 * Flatten a possibly-nested chain into DFS order; child nodes without their
 * own step>0 inherit the nearest ancestor step (shallow copies only).
 */
export function flattenChain(
  incoming: TxChainNode[] | null | undefined,
  inheritedStep = 0,
): TxChainNode[] {
  const out: TxChainNode[] = [];
  for (const n of incoming ?? []) {
    const step = n.step > 0 ? n.step : inheritedStep;
    out.push(step === n.step ? n : { ...n, step });
    const children = (n as TxChainNode & { children?: TxChainNode[] })
      .children;
    if (children && children.length) out.push(...flattenChain(children, step));
  }
  return out;
}

/**
 * Single business timeline (doc 01 D9 v3, mirrors the admin drawer):
 * - Nodes sorted by eventTime asc, then flowId asc.
 * - A nodeType===1 node with statusTo>0 and statusFrom!==statusTo opens a
 *   milestone group (self-loop markers are skipped).
 * - Any other node folds into the previous milestone contributing only its
 *   csTxId (deduped). A leading child node with no open milestone opens a
 *   head group titled "Processing" (to=0, primary tone).
 * - Amount extras (drawer caliber) attach to root milestones only:
 *   quote lock (to=5) carries principal / receiver amount / rate;
 *   payout & completion (30/35/40) carry the receiver amount.
 */
export function buildChainTimeline(
  nodes: TxChainNode[],
  row: Pick<TxRow, 'principal' | 'receiverAmount' | 'userRate'>,
): TimelineItem[] {
  const sorted = [...nodes].sort(
    (a, b) => a.eventTime - b.eventTime || a.flowId - b.flowId,
  );
  interface Group {
    flowId: number;
    to: number;
    time: number;
    operator: string;
    csTxIds: string[];
  }
  const groups: Group[] = [];
  for (const e of sorted) {
    const to = e.statusTo ?? 0;
    if (e.nodeType === 1 && to > 0) {
      if ((e.statusFrom ?? 0) === to) continue; // self-loop marker
      groups.push({
        flowId: e.flowId,
        to,
        time: e.eventTime,
        operator: e.operator ?? '',
        csTxIds: e.csTxId ? [e.csTxId] : [],
      });
      continue;
    }
    const last = groups[groups.length - 1];
    const cs = (e.csTxId ?? '').trim();
    if (!last) {
      groups.push({
        flowId: e.flowId,
        to: 0,
        time: e.eventTime,
        operator: e.operator ?? '',
        csTxIds: cs ? [cs] : [],
      });
    } else if (cs && !last.csTxIds.includes(cs)) {
      last.csTxIds.push(cs);
    }
  }
  return groups.map((g) => {
    const root = g.to > 0;
    const extras: string[] = [];
    if (root && g.to === 5) {
      if (row.principal != null) {
        extras.push(`Principal ${fmtAmount(row.principal)}`);
      }
      if (row.receiverAmount != null) {
        extras.push(`Receiver amount ${fmtAmount(row.receiverAmount)}`);
      }
      if (row.userRate != null) {
        extras.push(`Rate ${fmtRate(row.userRate)}`);
      }
    }
    if (
      root &&
      (g.to === 30 || g.to === 35 || g.to === 40) &&
      row.receiverAmount != null
    ) {
      extras.push(`Receiver amount ${fmtAmount(row.receiverAmount)}`);
    }
    for (const c of g.csTxIds) extras.push(`Voucher ${c}`);
    return {
      flowId: g.flowId,
      eventTime: g.time,
      title: root ? (NODE_TITLES[g.to] ?? 'Status updated') : 'Processing',
      who: g.operator ? g.operator : '',
      tone: nodeTone(g.to),
      extras,
    };
  });
}
