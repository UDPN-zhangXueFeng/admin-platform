import { apiClient, axiosClient } from '@myorg/shared/data-access-api';
import type {
  SpAccessAuditPayload,
  SpAccessDetail,
  SpAccessDownloadLicenseParams,
  SpAccessListParams,
  SpAccessListResponse,
  SpAccessListItem,
  SpAccessOperationRecord,
  SpAccessOperationRecordListParams,
  SpAccessOperationRecordListResponse,
  SpAccessPageInfo,
  SpAccessSavePayload,
  SpAccessStablecoinOption,
  SpAccessSubmittedTransaction,
  SpAccessSubmittedTransactionListParams,
  SpAccessSubmittedTransactionListResponse,
  SpAccessSftpBase64Params,
  SpAccessTypeOption,
  SpAccessUploadLicensePayload,
  SpAccessUploadLicenseResult,
  SpAccessUserWallet,
  SpAccessUserWalletListParams,
  SpAccessUserWalletListResponse,
  SpAccessWalletRule,
  SpAccessWalletRuleOption,
} from './sp-access.model';

interface SpAccessListApiResponse {
  rows?: SpAccessListItem[];
  page?: SpAccessPageInfo;
}

interface SpAccessDetailApiResponse extends Omit<SpAccessDetail, 'state'> {
  state?: number;
  spInfoState?: number;
}

interface SpAccessWalletRuleApiResponse {
  stablecoinId: number;
  name?: string;
  symbol?: string;
  blockchainName?: string;
  tokenType?: number;
  tdWalletRuleRespVOList?: Array<{
    walletRuleId?: number;
    ruleId?: number;
    name?: string;
    state?: number;
  }>;
}

interface SpAccessOperationRecordApiResponse {
  rows?: SpAccessOperationRecord[];
  page?: SpAccessPageInfo;
}

interface SpAccessUserWalletListApiResponse {
  rows?: SpAccessUserWallet[];
  page?: SpAccessPageInfo;
}

interface SpAccessSubmittedTransactionApiResponse {
  rows?: SpAccessSubmittedTransaction[];
  page?: SpAccessPageInfo;
}

function normalizePage(page: SpAccessPageInfo | undefined, rowCount: number, fallbackPageSize = 10) {
  return {
    total: page?.total ?? rowCount,
    pageNum: page?.pageNum ?? 1,
    pageSize: page?.pageSize ?? (rowCount || fallbackPageSize),
  };
}

function trimOrUndefined(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

// ---------- 列表 ----------

export async function getSpAccessList(params: SpAccessListParams): Promise<SpAccessListResponse> {
  const filters = params.filters ?? {};
  const response = await apiClient.post<SpAccessListApiResponse, unknown>(
    '/api/manage/v1/sp/access/listPage',
    {
      page: {
        pageNum: params.pageNum,
        pageSize: params.pageSize,
      },
      data: {
        spName: trimOrUndefined(filters.spName),
        // 契约：spType/state 因表单 initialValues 回填而恒发送（未筛选为 ''）
        spType: filters.spType ?? '',
        contactName: trimOrUndefined(filters.contactName),
        email: trimOrUndefined(filters.email),
        tdName: trimOrUndefined(filters.tdName),
        createStartTime: filters.createStartTime,
        createEndTime: filters.createEndTime,
        state: filters.state ?? '',
      },
    },
  );

  const rows = response.rows ?? [];
  return { rows, ...normalizePage(response.page, rows.length) };
}

// ---------- 详情 ----------

export async function getSpAccessDetail(spId: number): Promise<SpAccessDetail> {
  const response = await apiClient.post<SpAccessDetailApiResponse, { spId: number }>(
    '/api/manage/v1/sp/access/detail/basicInfo',
    { spId },
  );

  const { spInfoState, state, ...rest } = response;
  return {
    ...rest,
    // t_view 展示状态取 spInfoState，缺失回退 state
    state: spInfoState ?? state,
  };
}

/** 审批页契约:同一 basicInfo 端点,但入参字段名为 spRecordId(上游 approval.tsx:40-43)。 */
export async function getSpAccessApprovalDetail(spRecordId: number): Promise<SpAccessDetail> {
  const response = await apiClient.post<SpAccessDetailApiResponse, { spRecordId: number }>(
    '/api/manage/v1/sp/access/detail/basicInfo',
    { spRecordId },
  );
  const { state, ...rest } = response;
  return { ...rest, state };
}

// ---------- 详情子列表 ----------

export async function getSpAccessUserWallets(
  params: SpAccessUserWalletListParams,
): Promise<SpAccessUserWalletListResponse> {
  const response = await apiClient.post<
    SpAccessUserWalletListApiResponse,
    {
      page: { pageNum: number; pageSize: number };
      data: Partial<Omit<SpAccessUserWalletListParams, 'pageNum' | 'pageSize'>>;
    }
  >('/api/manage/v1/sp/access/detail/userWalletList', {
    page: { pageNum: params.pageNum, pageSize: params.pageSize },
    data: {
      spCode: params.spCode,
      walletAddress: trimOrUndefined(params.walletAddress),
      custodyModel: params.custodyModel === '' ? undefined : params.custodyModel,
      tokenName: trimOrUndefined(params.tokenName),
      tokenType: params.tokenType === '' ? undefined : params.tokenType,
      createStartTime: params.createStartTime,
      creatEndTime: params.creatEndTime,
      kycRequired: params.kycRequired === '' ? undefined : params.kycRequired,
      status: params.status === '' ? undefined : params.status,
    },
  });

  const rows = response.rows ?? [];
  return { rows, ...normalizePage(response.page, rows.length) };
}

export async function getSpAccessSubmittedTransactions(
  params: SpAccessSubmittedTransactionListParams,
): Promise<SpAccessSubmittedTransactionListResponse> {
  const response = await apiClient.post<
    SpAccessSubmittedTransactionApiResponse,
    {
      page: { pageNum: number; pageSize: number };
      data: Partial<Omit<SpAccessSubmittedTransactionListParams, 'pageNum' | 'pageSize'>>;
    }
  >('/api/manage/v1/sp/access/detail/transaction', {
    page: { pageNum: params.pageNum, pageSize: params.pageSize },
    data: {
      spCode: params.spCode,
      tokenCode: trimOrUndefined(params.tokenCode),
      txType: params.txType === '' ? undefined : params.txType,
      dataSource: params.dataSource === '' ? undefined : params.dataSource,
      status: params.status === '' ? undefined : params.status,
      txHash: trimOrUndefined(params.txHash),
      txStartTime: params.txStartTime,
      txEndTime: params.txEndTime,
    },
  });

  const rows = response.rows ?? [];
  return { rows, ...normalizePage(response.page, rows.length) };
}

export async function getSpAccessOperationRecords(
  params: SpAccessOperationRecordListParams,
): Promise<SpAccessOperationRecordListResponse> {
  const response = await apiClient.post<
    SpAccessOperationRecordApiResponse,
    {
      page: { pageNum: number; pageSize: number };
      data: { spCode?: string; operationType?: number | string };
    }
  >('/api/manage/v1/sp/access/detail/operationRecords', {
    page: { pageNum: params.pageNum, pageSize: params.pageSize },
    data: {
      spCode: params.spCode,
      operationType:
        params.operationType === undefined || params.operationType === ''
          ? undefined
          : params.operationType,
    },
  });

  const rows = response.rows ?? [];
  return { rows, ...normalizePage(response.page, rows.length) };
}

// ---------- 配置数据 ----------

export async function getSpAccessWalletRules(): Promise<SpAccessWalletRule[]> {
  const response = await apiClient.get<SpAccessWalletRuleApiResponse[]>(
    '/api/manage/v1/sp/access/walletRule/searches',
  );

  return (response ?? []).map((item) => ({
    stablecoinId: item.stablecoinId,
    name: item.name,
    symbol: item.symbol,
    blockchainName: item.blockchainName,
    tokenType: item.tokenType,
    walletRules: (item.tdWalletRuleRespVOList ?? []).flatMap(
      (rule): SpAccessWalletRuleOption[] => {
        // 上游实际字段是 ruleId（walletRuleId 为旧前端误设），归一化取第一个有效值
        const walletRuleId = rule.ruleId ?? rule.walletRuleId;
        if (typeof walletRuleId !== 'number') return [];
        return [{ walletRuleId, name: rule.name, state: rule.state }];
      },
    ),
  }));
}

export async function getSpAccessTypeOptions(): Promise<SpAccessTypeOption[]> {
  return (await apiClient.get<SpAccessTypeOption[]>('/api/manage/v1/sp/access/type/searches')) ?? [];
}

export async function getSpAccessStablecoinOptions(): Promise<SpAccessStablecoinOption[]> {
  return (
    (await apiClient.get<SpAccessStablecoinOption[]>('/api/manage/v1/sp/access/stablecoin/enabled')) ??
    []
  );
}

// ---------- 保存 / 编辑 / 审批 ----------

export async function createSpAccess(payload: SpAccessSavePayload): Promise<void> {
  await apiClient.post<void, SpAccessSavePayload>('/api/manage/v1/sp/access/save', payload);
}

export async function updateSpAccess(payload: SpAccessSavePayload): Promise<void> {
  await apiClient.post<void, SpAccessSavePayload>('/api/manage/v1/sp/access/edit', payload);
}

export async function auditSpAccess(payload: SpAccessAuditPayload): Promise<void> {
  await apiClient.post<void, SpAccessAuditPayload>('/api/manage/v1/sp/access/audit', payload);
}

// ---------- 文件 ----------

export async function uploadSpAccessBusinessLicense(
  payload: SpAccessUploadLicensePayload,
): Promise<SpAccessUploadLicenseResult> {
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

/**
 * 上游 getDownloadFileName：优先 `utf-8''` 段，回退 `filename=` 段，再回退调用方 fallback。
 */
function parseDownloadFileName(
  contentDisposition: string | undefined,
  fallback: string,
): string {
  const header = contentDisposition ?? '';
  const utf8Name = header.split(/utf-8''/)[1];
  if (utf8Name) {
    return decodeURIComponent(utf8Name);
  }
  const normalName = header.split('filename=')[1];
  if (!normalName) {
    return fallback;
  }
  return decodeURIComponent(normalName.replaceAll('"', '').trim());
}

export interface SpAccessFileDownload {
  blob: Blob;
  fileName: string;
}

/** GET sftp/download（blob，绕过 apiClient 信封，与 data-export 同模式） */
export async function downloadSpAccessBusinessLicense(
  params: SpAccessDownloadLicenseParams,
  fallbackFileName = 'business-license',
): Promise<SpAccessFileDownload> {
  const response = await axiosClient.get<Blob>('/api/base/v1/sftp/download', {
    params: { busId: params.busId, busType: params.busType },
    responseType: 'blob',
  });
  return {
    blob: response.data,
    fileName: parseDownloadFileName(
      response.headers['content-disposition'] as string | undefined,
      fallbackFileName,
    ),
  };
}

/** POST downloadSpSecretKey（blob zip），文件名回退 sp-secret-key-<spCode>.zip */
export async function downloadSpAccessSecretKey(
  spCode: string,
): Promise<SpAccessFileDownload> {
  const response = await axiosClient.post<Blob>(
    '/api/manage/v1/sp/access/downloadSpSecretKey',
    { spCode },
    { responseType: 'blob' },
  );
  return {
    blob: response.data,
    fileName: parseDownloadFileName(
      response.headers['content-disposition'] as string | undefined,
      `sp-secret-key-${spCode}.zip`,
    ),
  };
}

/**
 * POST sftp/base64。信封 data 缺失/为空时归一化 null（queryFn 不得返回 undefined）。
 * 上游在 code!==0 时静默降级，这里以 null 表达同一语义。
 */
export async function getSpAccessSftpBase64(
  params: SpAccessSftpBase64Params,
): Promise<string | null> {
  const response = await apiClient.post<string | null, SpAccessSftpBase64Params>(
    '/api/base/v1/sftp/base64',
    params,
  );
  return typeof response === 'string' && response.length > 0 ? response : null;
}
/**
 * POST user/wallet/txList（Txn Details 跳转预检）。上游 code!==0 抛错不路由，
 * 这里同等语义：非 0 业务码抛错，成功返回 void。
 */
export async function preflightUserWalletTxList(payload: {
  walletId: number;
}): Promise<void> {
  await apiClient.post<unknown, { page: { pageNum: number; pageSize: number }; data: { walletId: number } }>(
    '/api/manage/v1/user/wallet/txList',
    { page: { pageNum: 1, pageSize: 10 }, data: { walletId: payload.walletId } },
  );
}
