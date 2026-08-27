'use client';

/**
 * Transaction chain pure helpers (LP/03 B2 - private feature module).
 *
 * All stage inference / flattening / status-caliber tables live here as pure
 * functions so they stay unit-testable in isolation; UI components consume
 * their results only. Semantics are translated 1:1 from doc 01 section D9
 * and legacy `src/views/tx-flow/chain-drawer.vue`:
 *
 * - flattenChain: chain response may arrive as a node tree (with children)
 *   or a flat array; nodes inherit the parent step when their own step<=0.
 * - buildStageList: fixed 8-step axis inferred from flat nodes plus the
 *   transaction status.
 * - Dual status calibers (doc 01 E14): the list marks code 35 as an
 *   in-flight primary tone, while the drawer treats 35 as a success tone;
 *   every other code maps identically. Unknown codes fall back to a neutral
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
/* Code tables                                                         */
/* ================================================================== */

/** Stage axis labels (step 1..8, fixed order). */
export const STAGE_STEP_MAP: Record<number, string> = {
  1: 'Quote',
  2: 'Confirm',
  3: 'Source Transfer',
  4: 'Source Verification',
  5: 'Advance Disbursement',
  6: 'Credit',
  7: 'Settlement',
  8: 'Complete',
};

/** Stage statuses (1 not started / 2 in progress / 3 success / 4 failed / 5 skipped). */
export const STAGE_STATUS_MAP: Record<number, string> = {
  1: 'Not Started',
  2: 'In Progress',
  3: 'Success',
  4: 'Failed',
  5: 'Skipped',
};

/** Event node types (2 action / 3 message / 4 retry; 1 falls back to the raw value). */
export const EVENT_TYPE_MAP: Record<number, string> = {
  2: 'Action',
  3: 'Message',
  4: 'Retry',
};

/* ================================================================== */
/* List/drawer row shape extensions (backend VO drift window)          */
/* ================================================================== */

/**
 * Fields carried by the real row VO but not yet declared on `TxRow`
 * (same reconciliation pattern as `txNoText` for txUuid). Read through a
 * single cast here so pages never hand-roll divergent accessors:
 *
 * - txUuid preferred over txNo for the business number
 * - pairCode displayed raw with '-' fallback in the token pair column
 * - receiverAmount rendered with the shared money formatter
 * - failReason shown as a tooltip on the status cell
 * - dataTime is the sync-layer data timestamp; absent/0 renders '-'
 */
export interface TxRowVO extends TxRow {
  txUuid?: string | null;
  pairCode?: string | null;
  receiverAmount?: number | null;
  failReason?: string | null;
  dataTime?: number | null;
}

/** Cast helper used by every consumer (one caliber, no per-page drift). */
export function asTxRowVO(row: TxRow): TxRowVO {
  return row as TxRowVO;
}

/* ================================================================== */
/* Dual-caliber transaction status badge                               */
/* ================================================================== */

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline';

/**
 * LIST caliber (doc 01 D9/E14, checked state by state):
 * 40 success -> default; 50 warning -> outline + amber stroke;
 * 60/80 info -> outline; 70/90 danger -> destructive;
 * EVERYTHING ELSE - including 35 credited - stays in-flight primary ->
 * secondary. Unknown codes land in the same neutral fallback.
 */
export function txListVariant(status: number): BadgeVariant {
  if (status === 40) return 'default';
  if (status === 70 || status === 90) return 'destructive';
  if (status === 50 || status === 60 || status === 80) return 'outline';
  return 'secondary';
}

/** Amber stroke overlay for the single warning-tier code 50 (reversing). */
export function txWarnClass(status: number): string | undefined {
  return status === 50 ? TX_STATUS_WARN_CLASS : undefined;
}

/**
 * DRAWER caliber reuses the domain table where 35 maps to the success tone
 * (default), while the rest keep the list layering above. Both calibers
 * share one unknown-code fallback: secondary badge + raw number.
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
 * global `formatMoney` which preserves backend digits verbatim. Non-finite
 * or null input renders '-'.
 */
export function fmtAmount(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return '-';
  return Number(v).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
}

export function completedTimeText(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '-';
  return ms === 0 ? '-' : formatTime(ms);
}
/* ================================================================== */
/* Flatten + stage inference (translated verbatim, priority chain locked) */
/* ================================================================== */

/** One slot of the inferred stage axis (response carries no stage object). */
export interface StageItem {
  step: number;
  /** 1 not started / 2 in progress / 3 success / 4 failed / 5 skipped */
  status: number;
  startTime: number;
  endTime: number;
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
 * Fixed 8-slot stage axis; inference rules mirrored exactly from source:
 * - Only nodes with 1<=step<=8 feed the axis; maxStep = deepest populated step.
 * - Empty slots: txStatus===40 -> success(3); else step<maxStep -> skipped(5);
 *   else not started(1) with zeroed times.
 * - Populated slots: startTime=min eventTime, endTime=max eventTime;
 *   status priority chain: any node statusTo 70|90 -> failed(4);
 *   step<maxStep -> success(3); txStatus terminal 40|60|80 -> success(3);
 *   txStatus 70|90 -> failed(4); otherwise in progress(2).
 */
export function buildStageList(
  nodes: TxChainNode[],
  txStatus: number,
): StageItem[] {
  if (!nodes.length) return [];
  const byStep = new Map<number, TxChainNode[]>();
  let maxStep = 0;
  for (const n of nodes) {
    if (n.step < 1 || n.step > 8) continue;
    const list = byStep.get(n.step) ?? [];
    list.push(n);
    byStep.set(n.step, list);
    if (n.step > maxStep) maxStep = n.step;
  }
  const list: StageItem[] = [];
  for (let step = 1; step <= 8; step++) {
    const stepNodes = byStep.get(step);
    if (!stepNodes) {
      let status = 1;
      if (txStatus === 40) status = 3;
      else if (maxStep > 0 && step < maxStep) status = 5;
      list.push({ step, status, startTime: 0, endTime: 0 });
      continue;
    }
    let startTime = 0;
    let endTime = 0;
    for (const n of stepNodes) {
      if (startTime === 0 || n.eventTime < startTime) startTime = n.eventTime;
      if (n.eventTime > endTime) endTime = n.eventTime;
    }
    let status: number;
    if (stepNodes.some((n) => n.statusTo === 70 || n.statusTo === 90))
      status = 4;
    else if (step < maxStep) status = 3;
    else if (txStatus === 40 || txStatus === 60 || txStatus === 80) status = 3;
    else if (txStatus === 70 || txStatus === 90) status = 4;
    else status = 2;
    list.push({ step, status, startTime, endTime });
  }
  return list;
}

/** Default selection priority: first in-progress/failed stage ?? first stage holding nodes ?? step 1. */
export function pickInitialStep(
  stages: StageItem[],
  nodes: TxChainNode[],
): number {
  const active =
    stages.find((s) => s.status === 2 || s.status === 4) ??
    stages.find((s) => nodes.some((n) => n.step === s.step));
  return active ? active.step : 1;
}

/** Status transition display: hidden only when both ends are 0. */
export function hasTransit(e: TxChainNode): boolean {
  return (e.statusFrom ?? 0) !== 0 || (e.statusTo ?? 0) !== 0;
}

/** `from -> to` status text using the shared label table (raw numbers as fallback). */
export function transitText(e: TxChainNode): string {
  const from = e.statusFrom ?? 0;
  const to = e.statusTo ?? 0;
  return `${TX_STATUS_LABEL[from] ?? from} -> ${TX_STATUS_LABEL[to] ?? to}`;
}
