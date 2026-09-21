import { apiClient, type ApiRequestConfig } from '@myorg/shared/data-access-api';
import type {
  AuditTrailDetail,
  AuditTrailListParams,
  AuditTrailListResponse,
  BlockchainOption,
  ExportAuditTaskReq,
  StablecoinSearchOption,
} from './audit-trail.model';
import type { AuditTrailItem } from './audit-trail.model';

/**
 * Audit Trail API。
 *
 * endpoint base `/api/manage/v1/`（源自 td-manage index.tsx + view.tsx，已确认）。
 * `apiClient` 自动解包 `{ code, message, data }` 信封并在 `code !== 0` 时抛错。
 * 列表行注入 `id = String(traceId)` 满足 DataTable 契约。
 */
const AUDIT_LIST_URL = '/api/manage/v1/financial/audit/listPage';
const AUDIT_DETAIL_URL = '/api/manage/v1/financial/audit/detail';
const EXPORT_TASK_URL = '/api/manage/v1/export/task/create';
const STABLECOIN_SEARCHES_URL =
  '/api/manage/v1/common/stablecoin/enabled/searches';
const BLOCKCHAIN_LIST_URL = '/api/manage/v1/common/blockchain/list';

/** 后端列表行（无 id）。仅用于 id 注入。 */
type AuditTrailItemApi = Omit<AuditTrailItem, 'id'>;

interface ListResponseApi {
  page?: AuditTrailListResponse['page'];
  rows?: AuditTrailItemApi[];
}

/**
 * 查询 Audit 列表（listPage，服务端分页）。
 * 请求体 `{ data: filters, page: { pageNum, pageSize } }`（CustomTable 约定）。
 */
export async function getAuditTrailList(
  params: AuditTrailListParams,
  config?: ApiRequestConfig,
): Promise<AuditTrailListResponse> {
  const response = await apiClient.post<ListResponseApi>(
    AUDIT_LIST_URL,
    {
      data: params.filters,
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    },
    config,
  );
  return {
    page: response.page,
    rows: (response.rows ?? []).map((row): AuditTrailItem => ({
      ...row,
      id: String(row.traceId ?? ''),
    })),
  };
}

/**
 * 查询 Audit 详情（detail，body { traceId }）。
 */
export async function getAuditTrailDetail(
  traceId: number | string,
  config?: ApiRequestConfig,
): Promise<AuditTrailDetail | undefined> {
  const data = await apiClient.post<AuditTrailDetail | null>(
    AUDIT_DETAIL_URL,
    { traceId },
    config,
  );
  return data ?? undefined;
}

/**
 * 创建导出任务（exportTaskcreateApi）。
 * - 顶部 Download：auditTrailDownloadReqVO = 全筛选条件。
 * - 行 Download：auditTrailDownloadReqVO = { traceId }。
 */
export function createExportTask(
  req: ExportAuditTaskReq,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(EXPORT_TASK_URL, req, config);
}

/** 查询启用的 stablecoin（token 名称下拉）。 */
export function getStablecoinSearches(
  config?: ApiRequestConfig,
): Promise<StablecoinSearchOption[]> {
  return apiClient.get<StablecoinSearchOption[]>(
    STABLECOIN_SEARCHES_URL,
    config,
  );
}

/** 查询区块链下拉。 */
export function getBlockchainList(
  config?: ApiRequestConfig,
): Promise<BlockchainOption[]> {
  return apiClient.get<BlockchainOption[]>(BLOCKCHAIN_LIST_URL, config);
}
