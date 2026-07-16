export interface SpAccessRecord {
  id: string;
  spRecordId: number;
  spId?: number;
  spCode?: string;
  serviceProviderName: string;
  serviceProviderType: string;
  contactName?: string;
  email?: string;
  tdName?: string;
  stablecoinCode?: string;
  stablecoinName?: string;
  status: number;
  transactionPolicy?: string;
  privateKeyCustodyModel?: string;
  updatedAt?: number;
  createdAt?: number;
}

export interface SpAccessListFilters {
  serviceProviderName?: string;
  serviceProviderType?: number;
  contactName?: string;
  email?: string;
  status?: number;
  stablecoinName?: string;
}

export interface SpAccessListParams {
  pageNum: number;
  pageSize: number;
  filters?: SpAccessListFilters;
}

export interface SpAccessListResponse {
  rows: SpAccessRecord[];
  total: number;
  pageNum: number;
  pageSize: number;
}

export interface SpAccessOperationRecord {
  spRecordId: number;
  operationType?: number;
  state?: number;
  createUserName?: string;
  createTime?: number;
  businessCode?: string;
  taskId?: number;
}

export interface SpAccessOperationRecordListResponse {
  rows: SpAccessOperationRecord[];
  total: number;
  pageNum: number;
  pageSize: number;
}

export interface SpAccessDetailListParams {
  spCode: string;
  pageNum: number;
  pageSize: number;
}

export interface SpAccessUserWalletRecord {
  id: string;
  walletId?: number;
  walletAddress?: string;
  walletType?: string;
  custodyModel?: number;
  stablecoinName?: string;
  tokenType?: number;
  totalBalance?: number;
  kycRequired?: number;
  status?: number;
  createdAt?: number;
}

export interface SpAccessUserWalletListResponse {
  rows: SpAccessUserWalletRecord[];
  total: number;
  pageNum: number;
  pageSize: number;
}

export interface SpAccessSubmittedTransactionRecord {
  id: string;
  tokenName?: string;
  tokenType?: number;
  transactionType?: number;
  amount?: number;
  submissionMethod?: number;
  transactionHash?: string;
  status?: number;
  transactionTime?: number;
  createdAt?: number;
}

export interface SpAccessSubmittedTransactionListResponse {
  rows: SpAccessSubmittedTransactionRecord[];
  total: number;
  pageNum: number;
  pageSize: number;
}

export interface SpAccessTdAccess {
  tdId?: number;
  stablecoinId?: number;
  stablecoinCode: string;
  stablecoinName?: string;
  blockchainName?: string;
  tokenType?: string;
  walletAddress?: string;
  state?: number;
  kycRequired?: number;
  tokenPermissionEnabled: boolean;
  contractAddress?: string;
  webhookUrl?: string;
  apiEnabled?: boolean;
  contractEnabled?: boolean;
  apiPermissions?: SpAccessPermissionSelection[];
  contractPermissions?: SpAccessPermissionSelection[];
}

export interface SpAccessPermissionSelection {
  accessConfId: number;
  walletTypeIdList: number[];
}

export interface SpAccessDetail {
  spId?: number;
  spRecordId: number;
  spCode: string;
  serviceProviderName: string;
  serviceProviderType: string;
  contactName?: string;
  email?: string;
  phone?: string;
  businessLicenseFileId?: string;
  businessLicenseFileName?: string;
  businessLicensePreviewUrl?: string;
  businessLicenseFileType?: string;
  busType?: number;
  stablecoinName?: string;
  status: number;
  description?: string;
  privateKeyCustodyModel?: string;
  transactionPolicy?: string;
  metaType?: number;
  reconciliationFrequency?: number;
  reconciliationEnabled?: boolean;
  tdAccessList: SpAccessTdAccess[];
  createdAt?: number;
  updatedAt?: number;
}

export interface SpAccessOption {
  label: string;
  value: string;
}

export interface SpAccessStablecoinOption {
  stablecoinId?: number;
  stablecoinCode?: string;
  name: string;
  blockchainNameAbbreviation?: string;
  tokenType?: string;
  blockchainName?: string;
}

export interface SpAccessWalletRule {
  stablecoinId: number;
  stablecoinCode: string;
  stablecoinName: string;
  blockchainName?: string;
  tokenType?: string;
  walletRules: SpAccessWalletRuleOption[];
}

export interface SpAccessTypeOption {
  accessConfId: number;
  label: string;
  apiFuncName?: string;
  apiFuncUrl?: string;
  contractFuncName?: string;
}

export interface SpAccessWalletRuleOption {
  walletRuleId: number;
  name: string;
  state: number;
}

export interface SpAccessUploadFilePayload {
  file: File;
  busType: string;
}

export interface SpAccessUploadFileResponse {
  fileId: number;
}

export interface SpAccessSavePayload {
  spName: string;
  contactName: string;
  email: string;
  phone?: string;
  description?: string;
  fileId: number;
  spType: number;
  metaType: number;
  reconciliationFrequency: number;
  privateKeyCustodyModel: string;
  transactionPolicy: string;
  tdAccessList: SpAccessTdAccess[];
}

export interface SpAccessEditPayload extends SpAccessSavePayload {
  spCode: string;
}
