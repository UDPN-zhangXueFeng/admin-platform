/**
 * Bank domain (source `api/bank.ts`; rowKey=bankId, tokenized v2.0).
 *
 * Bank fields follow source `BankRow` verbatim; statuses map to
 * bankStatusVariant for the shared Badge.
 */

/** Row of POST /manage/bank/list (source BankRow @ 3c4cfbb). */
export interface BankRow {
  bankId: number;
  bankName: string;
  /**
   * Bank code (BIC). Source 2026-09-08 merged the former bankCode + bic
   * columns into one; also the bootstrap auth half (BIC + access key).
   */
  bankBic: string;
  /** Official website URL. */
  website: string;
  /** Logo URL (20px img in the list name cell; hidden when it fails to load). */
  logo: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  /** Gateway account config (JSON string), owned by instance registration. */
  accountConfig?: string;
  /** See BANK_STATUS_LABEL (1/5/10/15/20/50). */
  status: number;
  /** Reserved upstream; connectivity moved to the instance domain. */
  connectivityStatus?: number;
  createTime: number;
}

/** Filter of POST /manage/bank/list (source data segment). */
export interface BankListFilter {
  bankName?: string;
  /** Merged bank code (BIC) filter (source 2026-09-08 bankCode→bankBic). */
  bankBic?: string;
  status?: number;
}

export interface BankListReq {
  pageNum: number;
  pageSize: number;
  filter: BankListFilter;
}

/**
 * Aligned with backend BankSaveReqVO; bankId absent=create (saved directly as
 * status 10 Registered - pending onboarding), present=edit.
 *
 * Source 2026-09-08: bankCode+bic merged into bankBic; website/logo added;
 * contact fields returned to the form (optional); currency-system fields
 * moved to gateway-instance registration.
 */
export interface BankSaveReq {
  bankId?: number;
  bankName: string;
  /** Merged bank code (BIC), max length 64. */
  bankBic: string;
  website?: string;
  logo?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  accountConfig?: string;
}

/** Bank status (source BANK_STATUS_MAP). */
export const BANK_STATUS_LABEL: Record<number, string> = {
  1: 'Draft',
  5: 'Pending Review',
  10: 'Registered (Pending Onboarding)',
  15: 'Rejected',
  20: 'Onboarded',
  50: 'Disabled',
};

/** Status dropdown options: only 1/10/20/50 (5/15 are approval-flow states). */
export const BANK_STATUS_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 1, label: 'Draft' },
  { value: 10, label: 'Registered (Pending Onboarding)' },
  { value: 20, label: 'Onboarded' },
  { value: 50, label: 'Disabled' },
];

export type BankBadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/** Badge variant per status (source bankStatusTagType). */
export function bankStatusVariant(status: number | undefined): BankBadgeVariant {
  switch (status) {
    case 20:
      return 'default';
    case 5:
    case 10:
      return 'outline';
    case 15:
      return 'destructive';
    default:
      return 'secondary';
  }
}

/** Currency system type (source CS_TYPE_MAP; 0=Not specified). */
export const CS_TYPE_LABEL: Record<number, string> = {
  0: 'Not specified',
  1: 'Blockchain',
  2: 'Conventional',
  3: 'Other',
};

export const CS_TYPE_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 0, label: 'Not specified' },
  { value: 1, label: 'Blockchain' },
  { value: 2, label: 'Conventional' },
  { value: 3, label: 'Other' },
];
