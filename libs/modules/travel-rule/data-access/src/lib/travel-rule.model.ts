import type { PaginationParams } from '@myorg/shared/model';
import type {
  VerificationStatus,
  TransactionType,
} from '@myorg/modules/travel-rule/util';

// Re-export the shared status/type unions — canonical definitions live in
// `util` so the ui status badge and the data-access model share one source
// of truth (and so `type:ui` never has to depend on `type:data-access`).
export type { VerificationStatus, TransactionType };

/**
 * Core Travel Rule entity — a single travel-rule transaction-flow record.
 *
 * Field names mirror the source page (td-manage `financial/travel-rule`) so
 * the migration stays a 1:1 mapping. Timestamps are epoch milliseconds;
 * `confirmationTime` may be `null` while verification is still pending.
 */
export interface TravelRuleItem {
  /** Row identifier (string — required by the shared DataTable's `{ id: string }` contract) */
  id: string;
  transactionHash: string;
  tokenName: string;
  tokenType: string;
  /** Sending Service Provider id, e.g. "SP001" */
  sendingSP: string;
  senderWallet: string;
  /** Receiving Service Provider id, e.g. "SP002" */
  receivingSP: string;
  receiverWallet: string;
  blockchain: string;
  transactionType: TransactionType;
  /** Pre-formatted amount string, e.g. "10,000.00 HSC" */
  transactionAmount: string;
  /** Epoch ms */
  transactionTime: number;
  travelRuleHash: string;
  /** Epoch ms; `null` until verification is confirmed */
  confirmationTime: number | null;
  verificationStatus: VerificationStatus;
}

/**
 * Query parameters for the travel-rule list.
 *
 * Mirrors the query-form fields and extends `PaginationParams` so the exact
 * same shape can be posted to the real API later without page-level changes
 * (see PRD §8 — only the `queryFn` swaps).
 *
 * Date-range fields are `[fromMs, toMs]` tuples; `null`/`undefined` means
 * "no range filter".
 */
export interface TravelRuleQueryParams extends PaginationParams {
  transactionHash?: string;
  senderWallet?: string;
  receivingSP?: string;
  receiverWallet?: string;
  travelRuleHash?: string;
  tokenName?: string;
  sendingSP?: string;
  transactionType?: TransactionType;
  verificationStatus?: VerificationStatus;
  /** `[fromMs, toMs]` inclusive */
  transactionTime?: [number, number] | null;
  /** `[fromMs, toMs]` inclusive */
  confirmationTime?: [number, number] | null;
}
