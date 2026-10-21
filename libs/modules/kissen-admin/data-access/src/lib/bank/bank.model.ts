/**
 * Bank domain (source `api/bank.ts`; rowKey=bankId, tokenized v2.0).
 *
 * Bank fields follow source `BankRow` verbatim.
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
  /**
   * Logo stored as a 64×64 PNG data URI (source 2026-09-09 upload+compress,
   * no file service) or a legacy URL. Rendered as a small img next to the
   * bank name; hidden when it fails to load.
   */
  logo: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  /** Gateway account config (JSON string), owned by instance registration. */
  accountConfig?: string;
  /** 通用值域 1/2/5/10/15/20/50,文案见 feature PROTO_BANK_STATUS(20 Onboarded 例外)。 */
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
 * status 2 Registered), present=edit.
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


export type BankBadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';


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
