/**
 * Access-key domain (source `api/access-key.ts`; rowKey=keyId).
 *
 * The bootstrap auth pair is Bank BIC + access key; the key is deployed as a
 * gateway launch parameter, auto-revoked once the instance activates, and its
 * plaintext is shown exactly once at generation time.
 */

/** Row of POST /manage/bank/access-key/list (source AccessKeyRow). */
export interface AccessKeyRow {
  keyId: number;
  bankId: number;
  /** SHA fingerprint shown in the ledger; plaintext never listed again. */
  keyFingerprint: string;
  /** See KEY_STATUS_LABEL (20/50/60). */
  status: number;
  revokeTime?: number;
  revokeReason?: number;
  /** Gateway instance this key was bound to (0/absent = unbound). */
  instanceId?: number;
  createTime: number;
}

/** Body of POST /manage/bank/{bankId}/access-key (generation response). */
export interface AccessKeyGenerated {
  keyId: number;
  /** Plaintext; returned exactly once. */
  accessKey: string;
  keyFingerprint: string;
  bankBic?: string;
}

/** Access-key status (source KEY_STATUS_MAP). */
export const KEY_STATUS_LABEL: Record<number, string> = {
  20: 'Active',
  50: 'Revoked',
  60: 'Expired',
};

/** Revoke reason (source REVOKE_REASON_MAP). */
export const REVOKE_REASON_LABEL: Record<number, string> = {
  0: '—',
  1: 'Revoked on activation',
  2: 'Manually revoked',
  3: 'Expired',
};

export interface AccessKeyListFilter {
  bankId?: number;
  status?: number;
}

export interface AccessKeyRevokeReq {
  keyId: number;
  /** Required, 1-200 chars (validated by the caller). */
  reason: string;
}
