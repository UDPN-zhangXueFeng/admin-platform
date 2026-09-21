/**
 * Travel Rule shared constants and primitive types.
 *
 * Lives in `util` (the lowest importable layer) so both the `ui` status badge
 * and the `data-access` model can reference the SAME type definitions without
 * violating Nx module-boundary rules (a `type:ui` lib may not depend on a
 * `type:data-access` lib, but both may depend on `type:util`).
 *
 * Labels are English to match the source page (td-manage financial/travel-rule).
 * Call sites localise via the badge `label` prop / form option builders.
 */

/** Verification status of a travel-rule transaction flow. */
export type VerificationStatus = 'Pending' | 'Verified' | 'Rejected';

/** Transaction type bucket. */
export type TransactionType = 'Transfer' | 'Authorized Transfer';

/** All verification-status values, in display order. */
export const VERIFICATION_STATUS_VALUES: readonly VerificationStatus[] = [
  'Pending',
  'Verified',
  'Rejected',
] as const;

/** All transaction-type values, in display order. */
export const TRANSACTION_TYPE_VALUES: readonly TransactionType[] = [
  'Transfer',
  'Authorized Transfer',
] as const;

/** Default English labels for each verification status. */
export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  Pending: 'Pending',
  Verified: 'Verified',
  Rejected: 'Rejected',
};
