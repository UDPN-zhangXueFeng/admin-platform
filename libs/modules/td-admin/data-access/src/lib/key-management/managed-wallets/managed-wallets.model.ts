/**
 * Managed Wallets domain types.
 *
 * Strictly decoupled from UI and networking concerns.
 * Covers list, detail, and rotation history endpoints.
 */

/** A single row in the managed-wallets list. */
export interface ManagedWallet {
  chainAccountId?: number;
  walletAddress?: string;
  keyId?: string;
  /** Role name — number in list context (see managed-wallets.md §8.B). */
  roleName?: number;
  tokenName?: string;
  tokenType?: number;
  blockchainName?: string;
  blockchainCode?: string;
  keyServiceName?: string;
  storageType: string;
  storageCode: string;
  /** Rotation frequency in list context (number), differs from detail (string) — see §8.C. */
  rotationFrequency?: number;
  rotationUnit?: unknown;
  walletType: number;
  lastRotationTime?: number;
  nextRotationTime?: number;
  createdOn?: number;
  status?: number;
}

/** Filters for the list endpoint (the inner `data` field). */
export interface ManagedWalletListFilters {
  walletAddress?: string;
  keyId?: string;
  /**
   * Intentionally optional despite the source contract marking it required.
   * The UI exposes an "All" option that sends no value — see managed-wallets.md §8.D.
   */
  roleName?: number;
  tokenId?: number;
  blockchainId?: number;
  startCreationDate?: number;
  endCreationDate?: number;
  status?: number;
}

/** Server-paginated list query. */
export interface ManagedWalletListParams {
  pageNum: number;
  pageSize: number;
  filters: ManagedWalletListFilters;
}

export interface ManagedWalletListPage {
  pageNum?: number;
  pageSize?: number;
  total?: number;
}

/** Paginated list response wrapper. */
export interface ManagedWalletListResponse {
  page: ManagedWalletListPage;
  rows: ManagedWallet[];
}

/** Single wallet detail request body. */
export interface ManagedWalletDetailReq {
  chainAccountId: number;
}

/** Detail view of a single managed wallet. */
export interface ManagedWalletDetail {
  chainAccountId?: number;
  walletAddress?: string;
  keyId?: string;
  /**
   * Role name — string | number in detail context, differs from list (number only).
   * See managed-wallets.md §8.B.
   */
  roleName?: string | number;
  token?: string;
  blockchainName?: string;
  publicKey?: string;
  keyServiceName?: string;
  status?: number;
  createdBy?: string;
  createdOn?: number;
  /** Rotation frequency in detail context (string), differs from list (number) — see §8.C. */
  rotationFrequency?: string;
  rotationTime?: string;
  rotationMethods?: string;
  lastRotationTime?: number;
  nextRotationTime?: number;
}

/** A single row in the rotation history table. */
export interface WalletRotationHistory {
  recordId?: number;
  originalWallet?: string;
  originalKeyId?: string;
  newWallet?: string;
  newKeyId?: string;
  blockchainId?: number;
  blockchainName?: string;
  createdBy?: string;
  createdOn?: number;
  transactionTime?: number;
  transactionHash?: string;
  status?: number;
  remarks?: string;
}

/** Filters for the rotation history endpoint (the inner `data` field). */
export interface WalletRotationHistoryFilters {
  chainAccountId: number;
  walletAddress?: string;
  keyId?: string;
  creationStartDate?: number;
  creationEndDate?: number;
  transactionHash?: string;
  status?: number;
}

/** Server-paginated rotation history query. */
export interface WalletRotationHistoryParams {
  pageNum: number;
  pageSize: number;
  filters: WalletRotationHistoryFilters;
}

export interface WalletRotationHistoryPage {
  pageNum?: number;
  pageSize?: number;
  total?: number;
}

/** Paginated rotation history response wrapper. */
export interface WalletRotationHistoryResponse {
  page: WalletRotationHistoryPage;
  rows: WalletRotationHistory[];
}
