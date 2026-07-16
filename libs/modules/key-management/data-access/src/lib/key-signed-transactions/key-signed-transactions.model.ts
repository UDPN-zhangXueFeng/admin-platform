/**
 * Key-Signed Transactions domain types.
 *
 * Strictly decoupled from UI and networking concerns.
 */

/** A single row in the key-signed-transactions list. */
export interface KeySignedTransaction {
  /** Tx Record Id */
  txRecordId?: number;
  /** Signature ID */
  signatureId?: string;
  /** Wallet Address */
  walletAddress?: string;
  /** Transaction Type */
  transactionType?: string;
  /** Signature Type */
  signatureType?: string;
  /** Token Name */
  tokenName?: string;
  /** Token Type */
  tokenType?: number;
  /** Blockchain Name */
  blockchainName?: string;
  /** Signature Time (timestamp ms) */
  signatureTime?: number;
  /** Submission Time (timestamp ms) */
  submissionTime?: number;
  /** Transaction Hash */
  transactionHash?: string;
  /** Key Service Name */
  keyServiceName?: string;
  /** Status code */
  status?: number;
  /** Browser Url */
  browserUrl?: string;
}

/** Detail view of a single key-signed transaction. */
export interface KeySignedTransactionDetail {
  txRecordId?: number;
  signatureId?: string;
  walletAddress?: string;
  transactionType?: string;
  signatureType?: string;
  tokenName?: string;
  tokenType?: number;
  blockchainName?: string;
  signatureTime?: number;
  submissionTime?: number;
  transactionHash?: string;
  /** Key Service / Signature Provider name */
  signatureProvider?: string;
  /** Key ID */
  keyId?: string;
  /** Raw unsigned message */
  rawMessage?: string;
  status?: number;
}

/** Third-party key service platform entry. */
export interface KeyServicePlatform {
  thirdPartyPlatformId?: number;
  platformName?: string;
}

/** Stablecoin / token option for filters. */
export interface StablecoinOption {
  stablecoinId: number;
  name: string;
  mintMethod?: number;
}

/** Blockchain option for filters. */
export interface BlockchainOption {
  key: number;
  value: string;
  status?: number;
}

/** Query filter data (the inner `data` field of the POST body). */
export interface KeySignedTransactionListFilters {
  signatureId?: string;
  thirdPartyPlatformId?: number | string;
  walletAddress?: string;
  transactionType?: string;
  signatureType?: string;
  tokenId?: number | string;
  blockchainId?: number | string;
  startSignatureDate?: string;
  endSignatureDate?: string;
  startSubmissionDate?: string;
  endSubmissionDate?: string;
  transactionHash?: string;
}

/** Query parameters for the list endpoint. */
export interface KeySignedTransactionListParams {
  page: {
    pageSize: number;
    pageNum: number;
  };
  data: KeySignedTransactionListFilters;
}

/** Paginated list response wrapper. */
export interface KeySignedTransactionListResponse {
  page: {
    pageNum: number;
    pageSize: number;
    total: number;
  };
  rows: KeySignedTransaction[];
}

/** Key service configuration list row. */
export interface KeyServiceConfiguration {
  id: string;
  keyServiceCode?: string;
  keyServiceName?: string;
  url?: string;
  supportedChains?: string;
  createdOn?: number;
  lastUpdated?: number;
  /** 1=Enabled, 2=Deprecated, 3=Processing, 4=Rejected. */
  status?: number;
}

/** Filters accepted by the key-service-configuration list endpoint. */
export interface KeyServiceConfigurationFilters {
  keyServiceName?: string;
  status?: number;
}

/** Server-paginated key service configuration query. */
export interface KeyServiceConfigurationListParams {
  pageNum: number;
  pageSize: number;
  filters: KeyServiceConfigurationFilters;
}

/** Server-paginated key service configuration response. */
export interface KeyServiceConfigurationListResponse {
  page?: {
    pageNum?: number;
    pageSize?: number;
    total?: number;
  };
  rows: KeyServiceConfiguration[];
}
