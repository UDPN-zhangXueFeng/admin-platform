import { apiClient } from '@myorg/shared/data-access-api';
import type {
  SpAccessDetailListParams,
  SpAccessDetail,
  SpAccessEditPayload,
  SpAccessListParams,
  SpAccessOperationRecordListResponse,
  SpAccessPermissionSelection,
  SpAccessListResponse,
  SpAccessSavePayload,
  SpAccessStablecoinOption,
  SpAccessSubmittedTransactionListResponse,
  SpAccessTypeOption,
  SpAccessUploadFilePayload,
  SpAccessUploadFileResponse,
  SpAccessUserWalletListResponse,
  SpAccessWalletRule,
  SpAccessWalletRuleOption,
} from './sp-access.model';

interface SpAccessListApiResponse {
  rows?: Array<{
    spId?: number;
    spRecordId?: number;
    spCode?: string;
    spName?: string;
    contactName?: string;
    email?: string;
    td?: string;
    tdInfo?: Array<{
      tdName?: string;
      blockchainNameAbbreviation?: string;
      tokenType?: number;
      stablecoinCode?: string;
    }>;
    state?: number;
    createTime?: number;
    spType?: number;
    privateKeyHostingType?: string;
  }>;
  page?: {
    total?: number;
    pageNum?: number;
    pageSize?: number;
  };
}

interface SpAccessDetailApiResponse {
  spId: number;
  spRecordId?: number;
  spCode: string;
  spName: string;
  contactName: string;
  email: string;
  phone?: string;
  spDesc: string;
  state: number;
  spInfoState: number;
  fileId: number;
  fileName: string;
  fileType: string;
  fileUrl: string;
  busType: number;
  createTime: number;
  spType?: number;
  metaType: number;
  reconciliationFrequency: number;
  privateKeyCustodyModel: string;
  transactionPolicy: string;
  operationContactName?: string;
  operationContactEmail?: string;
  operationContactPhone?: string;
  operationSpDesc?: string;
  operationSpType?: number;
  operationPrivateKeyHostingType?: string;
  tdList: Array<{
    tdId?: number;
    tdName?: string;
    blockchainName?: string;
    walletAddress?: string;
    contractAddress?: string;
    accessList?: Array<{
      accessType?: number;
      transactionToggle?: number;
      permissionsList?: Array<{
        accessConfId?: number;
        walletTypeIdList?: number[];
      }>;
      typeAndPermissionList?: Array<{
        accessConfId?: number;
        walletTypeList?: Array<{
          walletRuleId?: number;
          state?: number;
        }>;
      }>;
    }>;
    state: number;
    tokenType?: number;
    kycRequired?: number;
    webhookUrl?: string;
  }>;
}

interface SpAccessWalletRuleApiResponse {
  stablecoinId: number;
  name: string;
  symbol: string;
  blockchainName: string;
  tokenType?: number;
  tdWalletRuleRespVOList?: Array<{
    walletRuleId?: number;
    ruleId?: number;
    name?: string;
    state?: number;
  }>;
}

interface SpAccessTypeOptionApiResponse {
  accessConfId: number;
  name: string;
  contractFuncName: string;
  apiFuncName: string;
  apiFuncUrl: string;
}

interface SpAccessOperationRecordApiResponse {
  rows?: Array<{
    spRecordId?: number;
    type?: number;
    state?: number;
    createUserName?: string;
    createTime?: number;
    businessCode?: string;
    taskId?: number;
  }>;
  page?: {
    total?: number;
    pageNum?: number;
    pageSize?: number;
  };
}

interface SpAccessUserWalletListApiResponse {
  rows?: Array<{
    walletId?: number;
    walletAddress?: string;
    walletType?: string;
    privateKeyCustodyModel?: number;
    tdName?: string;
    tokenType?: number;
    stablecoinCount?: number;
    kycRequired?: number;
    state?: number;
    createTime?: number;
  }>;
  page?: {
    total?: number;
    pageNum?: number;
    pageSize?: number;
  };
}

interface SpAccessSubmittedTransactionApiResponse {
  rows?: Array<{
    tokenName?: string;
    tokenType?: number;
    txType?: number;
    amount?: number;
    dataSource?: number;
    txHash?: string;
    status?: number;
    txTime?: number;
    createTime?: number;
  }>;
  page?: {
    total?: number;
    pageNum?: number;
    pageSize?: number;
  };
}

interface SpAccessSaveOrEditAccessPayload {
  accessType: number;
  transactionToggle: number;
  permissionsList: SpAccessPermissionSelection[];
}

interface SpAccessSaveOrEditTdPayload {
  tdId: number;
  walletAddress: string;
  contractAddress: string;
  accessList: SpAccessSaveOrEditAccessPayload[];
  kycRequired: number;
  webhookUrl: string;
}

interface SpAccessSaveOrEditPayload {
  contactName: string;
  email: string;
  phone?: string;
  description?: string;
  fileId: number;
  tdAccessList: SpAccessSaveOrEditTdPayload[];
  spType: number;
  metaType: number;
  reconciliationFrequency: number;
  privateKeyCustodyModel: string;
  transactionPolicy: string;
}

const API_ACCESS_TYPE = 1;
const CONTRACT_ACCESS_TYPE = 5;
const TOGGLE_ENABLED = 1;
const KYC_NOT_REQUIRED = 1;

function buildTokenPermissionFlags(
  accessList?: SpAccessDetailApiResponse['tdList'][number]['accessList'],
): Pick<
  import('./sp-access.model').SpAccessTdAccess,
  'apiEnabled' | 'contractEnabled' | 'tokenPermissionEnabled'
> {
  const apiEnabled = (accessList ?? []).some((item) => item?.accessType === API_ACCESS_TYPE);
  const contractEnabled = (accessList ?? []).some(
    (item) => item?.accessType === CONTRACT_ACCESS_TYPE,
  );

  return {
    apiEnabled,
    contractEnabled,
    tokenPermissionEnabled: apiEnabled || contractEnabled,
  };
}

function mapPermissionsList(
  permissionsList?:
    | Array<{
        accessConfId?: number;
        walletTypeIdList?: number[];
      }>
    | Array<{
        accessConfId?: number;
        walletTypeList?: Array<{
          walletRuleId?: number;
          state?: number;
        }>;
      }>,
): SpAccessPermissionSelection[] {
  if (!permissionsList?.length) {
    return [];
  }

  const firstItem = permissionsList[0] as
    | {
        accessConfId?: number;
        walletTypeIdList?: number[];
      }
    | {
        accessConfId?: number;
        walletTypeList?: Array<{
          walletRuleId?: number;
          state?: number;
        }>;
      };

  if ('walletTypeList' in firstItem) {
    return (permissionsList as Array<{
      accessConfId?: number;
      walletTypeList?: Array<{
        walletRuleId?: number;
        state?: number;
      }>;
    }>)
      .filter((item): item is { accessConfId: number; walletTypeList?: Array<{ walletRuleId?: number; state?: number }> } =>
        typeof item?.accessConfId === 'number',
      )
      .map((item) => ({
        accessConfId: item.accessConfId,
        walletTypeIdList: Array.from(
          new Set(
            (item.walletTypeList ?? [])
              .filter((walletType) => walletType?.state !== 0 && typeof walletType?.walletRuleId === 'number')
              .map((walletType) => walletType.walletRuleId as number),
          ),
        ),
      }));
  }

  return (permissionsList as Array<{
    accessConfId?: number;
    walletTypeIdList?: number[];
  }>)
    .filter((item): item is { accessConfId: number; walletTypeIdList?: number[] } =>
      typeof item?.accessConfId === 'number',
    )
    .map((item) => ({
      accessConfId: item.accessConfId,
      walletTypeIdList: Array.from(
        new Set((item.walletTypeIdList ?? []).filter((value) => Number.isFinite(value))),
      ),
    }));
}

function buildAccessPayload(
  accessType: number,
  enabled: boolean | undefined,
  permissions: SpAccessPermissionSelection[] | undefined,
): SpAccessSaveOrEditAccessPayload[] {
  if (!enabled) return [];
  const normalizedPermissions = (permissions ?? []).filter(
    (item) => item.walletTypeIdList.length > 0,
  );

  return [
    {
      accessType,
      transactionToggle: TOGGLE_ENABLED,
      permissionsList: normalizedPermissions,
    },
  ];
}

function mapTdAccessPayload(tdAccessList: SpAccessSavePayload['tdAccessList']): SpAccessSaveOrEditTdPayload[] {
  return tdAccessList
    .filter((item) => item.tokenPermissionEnabled && typeof item.tdId === 'number')
    .map((item) => ({
      tdId: item.tdId as number,
      walletAddress: item.walletAddress?.trim() ?? '',
      contractAddress: item.contractAddress?.trim() ?? '',
      accessList: [
        ...buildAccessPayload(API_ACCESS_TYPE, item.apiEnabled, item.apiPermissions),
        ...buildAccessPayload(
          CONTRACT_ACCESS_TYPE,
          item.contractEnabled &&
            Boolean(item.contractAddress?.trim()) &&
            (item.contractPermissions?.length ?? 0) > 0,
          item.contractPermissions,
        ),
      ],
      kycRequired: item.kycRequired ?? KYC_NOT_REQUIRED,
      webhookUrl: item.webhookUrl?.trim() ?? '',
    }));
}

function mapSaveOrEditPayload(payload: SpAccessSavePayload): SpAccessSaveOrEditPayload {
  return {
    contactName: payload.contactName,
    email: payload.email,
    phone: payload.phone?.trim() || undefined,
    description: payload.description?.trim() || undefined,
    fileId: payload.fileId,
    tdAccessList: mapTdAccessPayload(payload.tdAccessList),
    spType: payload.spType,
    metaType: payload.metaType,
    reconciliationFrequency: payload.reconciliationFrequency,
    privateKeyCustodyModel: payload.privateKeyCustodyModel,
    transactionPolicy: payload.transactionPolicy,
  };
}

function mapListResponse(payload: SpAccessListApiResponse): SpAccessListResponse {
  const rows = (payload.rows ?? []).map((item) => {
    const spRecordId = item.spRecordId ?? 0;
    const stablecoinInfo = item.tdInfo?.[0];
    return {
      id: String((spRecordId || item.spId || item.spCode) ?? crypto.randomUUID()),
      spRecordId,
      spId: item.spId,
      spCode: item.spCode ?? '',
      serviceProviderName: item.spName ?? '--',
      serviceProviderType: item.spType ? String(item.spType) : '',
      contactName: item.contactName,
      email: item.email,
      tdName: item.td,
      stablecoinName: stablecoinInfo?.tdName ?? item.td,
      stablecoinCode: stablecoinInfo?.stablecoinCode,
      status: item.state ?? 0,
      privateKeyCustodyModel: item.privateKeyHostingType,
      updatedAt: item.createTime,
      createdAt: item.createTime,
    };
  });

  return {
    rows,
    total: payload.page?.total ?? 0,
    pageNum: payload.page?.pageNum ?? 1,
    pageSize: payload.page?.pageSize ?? (rows.length || 10),
  };
}

function mapOperationRecordListResponse(
  payload: SpAccessOperationRecordApiResponse,
): SpAccessOperationRecordListResponse {
  const rows = (payload.rows ?? []).map((item) => ({
    spRecordId: item.spRecordId ?? 0,
    operationType: item.type,
    state: item.state,
    createUserName: item.createUserName,
    createTime: item.createTime,
    businessCode: item.businessCode,
    taskId: item.taskId,
  }));

  return {
    rows,
    total: payload.page?.total ?? rows.length,
    pageNum: payload.page?.pageNum ?? 1,
    pageSize: payload.page?.pageSize ?? 10,
  };
}

function mapUserWalletListResponse(
  payload: SpAccessUserWalletListApiResponse,
): SpAccessUserWalletListResponse {
  const rows = (payload.rows ?? []).map((item, index) => ({
    id: String(item.walletId ?? item.walletAddress ?? index),
    walletId: item.walletId,
    walletAddress: item.walletAddress,
    walletType: item.walletType,
    custodyModel: item.privateKeyCustodyModel,
    stablecoinName: item.tdName,
    tokenType: item.tokenType,
    totalBalance: item.stablecoinCount,
    kycRequired: item.kycRequired,
    status: item.state,
    createdAt: item.createTime,
  }));

  return {
    rows,
    total: payload.page?.total ?? rows.length,
    pageNum: payload.page?.pageNum ?? 1,
    pageSize: payload.page?.pageSize ?? 10,
  };
}

function mapSubmittedTransactionListResponse(
  payload: SpAccessSubmittedTransactionApiResponse,
): SpAccessSubmittedTransactionListResponse {
  const rows = (payload.rows ?? []).map((item, index) => ({
    id: `${item.txHash ?? 'no-hash'}-${item.createTime ?? 0}-${item.txTime ?? 0}-${index}`,
    tokenName: item.tokenName,
    tokenType: item.tokenType,
    transactionType: item.txType,
    amount: item.amount,
    submissionMethod: item.dataSource,
    transactionHash: item.txHash,
    status: item.status,
    transactionTime: item.txTime,
    createdAt: item.createTime,
  }));

  return {
    rows,
    total: payload.page?.total ?? rows.length,
    pageNum: payload.page?.pageNum ?? 1,
    pageSize: payload.page?.pageSize ?? 10,
  };
}

export async function getSpAccessList(params: SpAccessListParams): Promise<SpAccessListResponse> {
  const response = await apiClient.post<SpAccessListApiResponse, unknown>(
    '/api/manage/v1/sp/access/listPage',
    {
      page: {
        pageNum: params.pageNum,
        pageSize: params.pageSize,
      },
      data: {
        spName: params.filters?.serviceProviderName || undefined,
        spType: params.filters?.serviceProviderType,
        contactName: params.filters?.contactName || undefined,
        email: params.filters?.email || undefined,
        status: params.filters?.status,
        tdName: params.filters?.stablecoinName || undefined,
      },
    },
  );

  return mapListResponse(response);
}

export async function getSpAccessDetail(spId: number): Promise<SpAccessDetail> {
  const response = await apiClient.post<SpAccessDetailApiResponse, { spId: number }>(
    '/api/manage/v1/sp/access/detail/basicInfo',
    { spId },
  );

  return {
    spId: response.spId,
    spRecordId: response.spRecordId ?? response.spId,
    spCode: response.spCode,
    serviceProviderName: response.spName,
    serviceProviderType: String(response.operationSpType ?? response.spType ?? ''),
    contactName: response.operationContactName ?? response.contactName,
    email: response.operationContactEmail ?? response.email,
    phone: response.operationContactPhone ?? response.phone,
    businessLicenseFileId: String(response.fileId),
    businessLicenseFileName: response.fileName,
    businessLicenseFileType: response.fileType,
    businessLicensePreviewUrl: response.fileUrl,
    busType: response.busType,
    status: response.spInfoState ?? response.state,
    description: response.operationSpDesc ?? response.spDesc,
    privateKeyCustodyModel:
      response.operationPrivateKeyHostingType ?? response.privateKeyCustodyModel,
    transactionPolicy: response.transactionPolicy,
    metaType: response.metaType,
    reconciliationFrequency: response.reconciliationFrequency,
    reconciliationEnabled: response.reconciliationFrequency > 0,
    tdAccessList: (response.tdList ?? []).map((item) => {
      const flags = buildTokenPermissionFlags(item.accessList);
      const apiAccess = (item.accessList ?? []).find((accessItem) => accessItem?.accessType === API_ACCESS_TYPE);
      const contractAccess = (item.accessList ?? []).find(
        (accessItem) => accessItem?.accessType === CONTRACT_ACCESS_TYPE,
      );

      return {
        tdId: item.tdId,
        stablecoinId: item.tdId,
        stablecoinCode: String(item.tdId ?? ''),
        stablecoinName: item.tdName,
        blockchainName: item.blockchainName,
        tokenType: typeof item.tokenType === 'number' ? String(item.tokenType) : undefined,
        walletAddress: item.walletAddress,
        state: item.state,
        kycRequired: item.kycRequired,
        contractAddress: item.contractAddress,
        webhookUrl: item.webhookUrl,
        apiPermissions: mapPermissionsList(
          apiAccess?.permissionsList ?? apiAccess?.typeAndPermissionList,
        ),
        contractPermissions: mapPermissionsList(
          contractAccess?.permissionsList ?? contractAccess?.typeAndPermissionList,
        ),
        ...flags,
      };
    }),
    createdAt: response.createTime,
    updatedAt: response.createTime,
  };
}

export async function getSpAccessOperationRecords(
  spCode: string,
): Promise<SpAccessOperationRecordListResponse> {
  const response = await apiClient.post<
    SpAccessOperationRecordApiResponse,
    {
      page: { pageNum: number; pageSize: number };
      data: { spCode: string };
    }
  >('/api/manage/v1/sp/access/detail/operationRecords', {
    page: {
      pageNum: 1,
      pageSize: 10,
    },
    data: {
      spCode,
    },
  });

  return mapOperationRecordListResponse(response);
}

export async function getSpAccessUserWallets(
  params: SpAccessDetailListParams,
): Promise<SpAccessUserWalletListResponse> {
  const response = await apiClient.post<
    SpAccessUserWalletListApiResponse,
    {
      page: { pageNum: number; pageSize: number };
      data: { spCode: string };
    }
  >('/api/manage/v1/sp/access/detail/userWalletList', {
    page: {
      pageNum: params.pageNum,
      pageSize: params.pageSize,
    },
    data: {
      spCode: params.spCode,
    },
  });

  return mapUserWalletListResponse(response);
}

export async function getSpAccessSubmittedTransactions(
  params: SpAccessDetailListParams,
): Promise<SpAccessSubmittedTransactionListResponse> {
  const response = await apiClient.post<
    SpAccessSubmittedTransactionApiResponse,
    {
      page: { pageNum: number; pageSize: number };
      data: { spCode: string };
    }
  >('/api/manage/v1/sp/access/detail/transaction', {
    page: {
      pageNum: params.pageNum,
      pageSize: params.pageSize,
    },
    data: {
      spCode: params.spCode,
    },
  });

  return mapSubmittedTransactionListResponse(response);
}

export async function getSpAccessWalletRules(): Promise<SpAccessWalletRule[]> {
  const response = await apiClient.get<SpAccessWalletRuleApiResponse[]>(
    '/api/manage/v1/sp/access/walletRule/searches',
  );

  return response.map((item) => ({
    stablecoinId: item.stablecoinId,
    stablecoinCode: String(item.stablecoinId),
    stablecoinName: item.name,
    blockchainName: item.blockchainName,
    tokenType: typeof item.tokenType === 'number' ? String(item.tokenType) : undefined,
    walletRules: (item.tdWalletRuleRespVOList ?? [])
      .map((rule) => ({
        walletRuleId: rule.walletRuleId ?? rule.ruleId,
        name: rule.name,
        state: rule.state ?? 1,
      }))
      .filter((rule): rule is { walletRuleId: number; name?: string; state: number } =>
        typeof rule.walletRuleId === 'number',
      )
      .map((rule): SpAccessWalletRuleOption => ({
        walletRuleId: rule.walletRuleId,
        name: rule.name ?? String(rule.walletRuleId),
        state: rule.state,
      })),
  }));
}

export async function getSpAccessTypeOptions(): Promise<SpAccessTypeOption[]> {
  const response = await apiClient.get<SpAccessTypeOptionApiResponse[]>(
    '/api/manage/v1/sp/access/type/searches',
  );

  return response.map((item) => ({
    accessConfId: item.accessConfId,
    label: item.name,
    apiFuncName: item.apiFuncName,
    apiFuncUrl: item.apiFuncUrl,
    contractFuncName: item.contractFuncName,
  }));
}

export async function getSpAccessStablecoinOptions(): Promise<SpAccessStablecoinOption[]> {
  return apiClient.get<SpAccessStablecoinOption[]>('/api/manage/v1/sp/access/stablecoin/enabled');
}

export async function createSpAccess(payload: SpAccessSavePayload): Promise<void> {
  await apiClient.post<void, SpAccessSaveOrEditPayload & { spName: string }>(
    '/api/manage/v1/sp/access/save',
    {
      spName: payload.spName,
      ...mapSaveOrEditPayload(payload),
    },
  );
}

export async function updateSpAccess(payload: SpAccessEditPayload): Promise<void> {
  await apiClient.post<void, SpAccessSaveOrEditPayload & { spCode: string; spName: string }>(
    '/api/manage/v1/sp/access/edit',
    {
      spCode: payload.spCode,
      spName: payload.spName,
      ...mapSaveOrEditPayload(payload),
    },
  );
}

export async function uploadSpAccessBusinessLicense(
  payload: SpAccessUploadFilePayload,
): Promise<SpAccessUploadFileResponse> {
  const formData = new FormData();
  formData.append('file', payload.file);
  formData.append('busType', payload.busType);

  const response = await apiClient.post<number | string, FormData>(
    '/api/base/v1/sftp/uploadFile',
    formData,
  );

  const fileId = Number(response);
  if (!Number.isFinite(fileId) || fileId <= 0) {
    throw new Error('Invalid business license file id.');
  }

  return { fileId };
}
