'use client';

/**
 * Transaction chain pure helpers (LP/03 B2 - private feature module).
 *
 * 2026-10-29 unified chain: the timeline inference layer (flattenChain /
 * buildChainTimeline / NODE_TITLES / nodeTone) is RETIRED - titles, stage
 * axis and desensitization now come server-side (TxChainAssembler + unified
 * copy table in kissen-api); the client-side inference was the drift source
 * between the admin and LP chain views (dispose nodes swallowed, vouchers
 * lost). What remains here: status badge calibers + money/time formatting
 * shared by the list page and the drawer.
 *
 * - Status calibers (doc 01 E14, revised 2026-09-04 aad34fa): 35 is a
 *   success terminal ("Completed") in BOTH list and drawer. Unknown codes
 *   fall back to a neutral secondary badge showing the raw number.
 *
 * Display copy and comments are English-only (hard constraint).
 */
import {
  TX_STATUS_LABEL,
  TX_STATUS_VARIANT,
  TX_STATUS_WARN_CLASS,
} from '@myorg/modules/lp-portal/data-access';

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
 * Amount text injected by the drawer (ed1a340/6a55188): token-precision
 * `formatAmount` + symbol suffix, keyed by the row's source/target token
 * code. Kept as a parameter so this module stays pure / unit-testable; the
 * old `fmtAmount` caliber (Number + toLocaleString min2/max8) is retired -
 * the drawer builds the callback from `useTokenMeta` + `formatAmount`.
 */
export type AmountText = (
  v: number | string | null | undefined,
  tokenCode: string | null | undefined,
) => string;

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

/** Timeline dot tone (UI concern; titles come from the server copy table). */
export type TimelineTone =
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'primary';
