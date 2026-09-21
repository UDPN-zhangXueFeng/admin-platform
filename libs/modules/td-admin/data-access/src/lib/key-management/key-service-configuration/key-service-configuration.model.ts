/**
 * Key Service Configuration domain types.
 *
 * Covers the detail view (Basic Information), the operation-records query, and
 * the third-party platform list used by the configure page. Source DTOs:
 * td-manage typings/token-manage/data-contracts `KeyServiceDetailRespVo`,
 * `KeyServiceOperationRecordRespVo`, `ThirdPartyPlatformRespVo`.
 */

/** An access-parameter row on the detail page. */
export interface KeyServiceAccessParameter {
  /** 1 = Request URL, 5 = Request Headers, 10 = Request Body. */
  parameterType?: number;
  parameterKey?: string;
  parameterValue?: string;
}

/** A supported-chain row on the detail page. */
export interface KeyServiceSupportedChain {
  blockchain?: string;
  serviceProviderBlockchainName?: string;
  serviceProviderBlockchainId?: string;
}

/**
 * Key service detail — `KeyServiceDetailRespVo`
 * (POST /api/manage/v1/key/config/detail).
 */
export interface KeyServiceDetail {
  keyServiceCode?: string;
  keyServiceName?: string;
  /** 1 = Enabled, 2 = Deprecated, 3 = Processing, 4 = Rejected. */
  status?: number;
  hotWalletGroupId?: string;
  coldWalletGroupId?: string;
  description?: string;
  url?: string;
  createdBy?: string;
  createdOn?: number;
  updatedBy?: string;
  updatedOn?: number;
  accessParameters?: KeyServiceAccessParameter[];
  supportedChains?: KeyServiceSupportedChain[];
}

/** Request body for the detail endpoint. */
export interface KeyServiceDetailReq {
  keyServiceCode: string;
}

/** A single row in the operation-records table. */
export interface KeyServiceOperationRecord {
  platformRecordId?: number;
  busCode?: string;
  keyServiceCode?: string;
  /** 1 = Configure, 2 = Edit, 3 = Enable, 4 = Deprecate, 5 = Delete, 6 = Resubmit. */
  operationType?: number;
  createdBy?: string;
  createdOn?: number;
  comments?: string;
  /** Operation-record status (10 states — see detail-page operationStatusMap). */
  status?: number;
}

/** Filter data for the operation-records endpoint (the inner `data` field). */
export interface KeyServiceOperationRecordFilters {
  keyServiceCode: string;
  operationType?: number;
}

/** Server-paginated operation-records query. */
export interface KeyServiceOperationRecordParams {
  pageNum: number;
  pageSize: number;
  filters: KeyServiceOperationRecordFilters;
}

export interface KeyServiceOperationRecordPage {
  pageNum?: number;
  pageSize?: number;
  total?: number;
}

/** Paginated operation-records response wrapper. */
export interface KeyServiceOperationRecordResponse {
  page?: KeyServiceOperationRecordPage;
  rows: KeyServiceOperationRecord[];
}

/**
 * Third-party key service platform entry — `ThirdPartyPlatformRespVo`
 * (POST /api/manage/v1/key/config/listKeyService).
 *
 * NOTE: structurally identical to `KeyServicePlatform` in
 * key-signed-transactions.model (same backend DTO). Defined locally to keep the
 * module self-contained; the barrel does not re-export it to avoid colliding
 * with the existing export from key-signed-transactions.
 */
export interface KeyServicePlatform {
  thirdPartyPlatformId?: number;
  platformName?: string;
}
