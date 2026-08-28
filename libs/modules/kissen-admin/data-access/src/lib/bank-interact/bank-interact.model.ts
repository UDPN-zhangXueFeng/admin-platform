/**
 * Bank-interact domain (source `api/bank-interact.ts`).
 *
 * Default posture is fully open: an onboarded bank interacts with every other
 * onboarded bank across all of their tokens. Rules are per (bankId,
 * peerBankId, tokenId|whole-row) and push to gateways immediately on save.
 */

/** Token slice of an interact peer row (source InteractTokenRow). */
export interface InteractTokenRow {
  tokenId: number;
  tokenCode: string;
  tokenName?: string;
  /** Symbol abbreviation; token display uses symbol first, falling back to code (source 2023418). */
  symbol: string;
  /** true = this bank is banned from transacting this peer token. */
  banned: boolean;
}

/** Peer bank row of POST /manage/bank-interact/view (source InteractPeerRow). */
export interface InteractPeerRow {
  bankId: number;
  bankName?: string;
  bankCode: string;
  bic?: string;
  /** true = whole row banned (all interaction with this peer bank). */
  wholeBanned: boolean;
  tokens: InteractTokenRow[];
}

/** Body of POST /manage/bank-interact/view. */
export interface InteractViewReq {
  bankId: number;
}

/** View payload: the peer list for one bank. */
export interface InteractViewResult {
  peers: InteractPeerRow[];
}

/**
 * Toggle rule (source InteractSaveReq):
 * - tokenId absent → whole-row switch, server clears token-level rules both ways;
 * - tokenId present → single token rule.
 */
export interface InteractSaveReq {
  bankId: number;
  peerBankId: number;
  tokenId?: number;
  banned: boolean;
}
