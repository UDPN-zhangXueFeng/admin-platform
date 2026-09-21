import { apiClient, type ApiRequestConfig } from '@myorg/shared/data-access-api';
import type {
  BlockchainOption,
  CreateExportRuleDTO,
  CreateExportTaskDTO,
  DeleteExportTaskDTO,
  ExportRule,
  ExportRuleDetail,
  ExportRuleListParams,
  ExportRuleListResponse,
  ExportTask,
  ExportTaskListParams,
  ExportTaskListResponse,
  OperateExportRuleDTO,
  ResultPageInfo,
  StablecoinSearchOption,
} from './statements.model';

/**
 * Statements API。
 *
 * endpoint base `/api/manage/v1/`（源自 td-manage index/export/view，已确认）。
 * `apiClient` 自动解包 `{ code, message, data }` 信封。列表行注入 id 满足 DataTable 契约。
 * 文件下载（sftp/download）为二进制 blob，绕过 apiClient 信封解包，用 fetch + a.click。
 */
const RULE_LIST_URL = '/api/manage/v1/export/task/list/rule';
const RULE_CREATE_URL = '/api/manage/v1/export/task/create/rule';
const RULE_OPERATE_URL = '/api/manage/v1/export/task/rule/operate';
const PERMISSION_EMAIL_URL = '/api/manage/v1/export/task/permission/email';
const TASK_LIST_MY_URL = '/api/manage/v1/export/task/list/my';
const TASK_CREATE_URL = '/api/manage/v1/export/task/create';
const TASK_LIST_ALL_URL = '/api/manage/v1/export/task/list/all';
const TASK_DELETE_URL = '/api/manage/v1/export/task/delete';
const RULE_DETAIL_URL = '/api/manage/v1/export/task/rule/detail';
const STABLECOIN_SEARCHES_URL =
  '/api/manage/v1/common/stablecoin/enabled/searches';
const BLOCKCHAIN_LIST_URL = '/api/manage/v1/common/blockchain/list';

/** 后端列表行（无 id）。 */
type ExportRuleApi = Omit<ExportRule, 'id'>;
type ExportTaskApi = Omit<ExportTask, 'id'>;
interface ListResponseApi<TRow> {
  page?: ResultPageInfo;
  rows?: TRow[];
}

/** 查询导出规则列表（list/rule）。 */
export async function getExportRuleList(
  params: ExportRuleListParams,
  config?: ApiRequestConfig,
): Promise<ExportRuleListResponse> {
  const res = await apiClient.post<ListResponseApi<ExportRuleApi>>(
    RULE_LIST_URL,
    {
      data: params.filters,
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    },
    config,
  );
  return {
    page: res.page,
    rows: (res.rows ?? []).map((r): ExportRule => ({
      ...r,
      id: String(r.exportRuleId ?? ''),
    })),
  };
}

/** 新建导出规则（create/rule）。 */
export function createExportRule(
  dto: CreateExportRuleDTO,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(RULE_CREATE_URL, dto, config);
}

/** 启用/禁用/删除规则（rule/operate，state 20/30/35）。 */
export function operateExportRule(
  dto: OperateExportRuleDTO,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(RULE_OPERATE_URL, dto, config);
}

/** 查询有权限用户邮箱（permission/email，selectAllUsers 勾选回填用）。 */
export function getPermissionEmails(
  premissionType: number,
  config?: ApiRequestConfig,
): Promise<string[]> {
  return apiClient.post<string[]>(PERMISSION_EMAIL_URL, { premissionType }, config);
}

/** 查询我的导出任务（list/my，moduleType=5）。 */
export async function getMyExportTaskList(
  params: ExportTaskListParams,
  config?: ApiRequestConfig,
): Promise<ExportTaskListResponse> {
  const res = await apiClient.post<ListResponseApi<ExportTaskApi>>(
    TASK_LIST_MY_URL,
    {
      data: { ...params.filters, moduleType: params.filters.moduleType ?? 5 },
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    },
    config,
  );
  return {
    page: res.page,
    rows: (res.rows ?? []).map((r): ExportTask => ({
      ...r,
      id: String(r.exportTaskId ?? ''),
    })),
  };
}

/** 创建导出任务（create）。 */
export function createExportTask(
  dto: CreateExportTaskDTO,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(TASK_CREATE_URL, dto, config);
}

/** 查询全部导出文件（list/all，按 exportRuleId）。 */
export async function getAllExportTaskList(
  params: ExportTaskListParams,
  config?: ApiRequestConfig,
): Promise<ExportTaskListResponse> {
  const res = await apiClient.post<ListResponseApi<ExportTaskApi>>(
    TASK_LIST_ALL_URL,
    {
      data: params.filters,
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    },
    config,
  );
  return {
    page: res.page,
    rows: (res.rows ?? []).map((r): ExportTask => ({
      ...r,
      id: String(r.exportTaskId ?? ''),
    })),
  };
}

/** 删除导出任务（delete）。 */
export function deleteExportTask(
  dto: DeleteExportTaskDTO,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(TASK_DELETE_URL, dto, config);
}

/** 查询规则详情（rule/detail，body { exportRuleId }）。 */
export async function getExportRuleDetail(
  exportRuleId: number | string,
  config?: ApiRequestConfig,
): Promise<ExportRuleDetail | undefined> {
  const data = await apiClient.post<ExportRuleDetail | null>(
    RULE_DETAIL_URL,
    { exportRuleId: Number(exportRuleId) },
    config,
  );
  return data ?? undefined;
}

/** 查询启用的 stablecoin 下拉。 */
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

/**
 * 下载导出文件（sftp/download，二进制 blob）。
 *
 * 绕过 apiClient 信封解包（blob 不走 {code,data}），用 fetch 取原始响应。
 * 文件名从 Content-Disposition `utf-8''fileName` 解析（源 downloadApi 行为）。
 * auth token 从 localStorage 读取（与 axios 拦截器一致，用 `token` header）。
 */
export async function downloadExportFile(
  busId: string | number,
  busType: string | number,
): Promise<void> {
  const base = process.env.NEXT_PUBLIC_FILE_ID ?? '';
  const url = `${base}/v1/sftp/download?busId=${encodeURIComponent(
    String(busId),
  )}&busType=${encodeURIComponent(String(busType))}`;
  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem('admin_platform_access_token') ?? ''
      : '';
  const res = await fetch(url, { headers: token ? { token } : {} });
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') ?? '';
  const fileNamePart = disposition.split("utf-8''")[1];
  const fileName = fileNamePart
    ? decodeURIComponent(fileNamePart)
    : 'export.xlsx';
  const elink = document.createElement('a');
  elink.download = fileName;
  elink.style.display = 'none';
  elink.href = URL.createObjectURL(blob);
  document.body.appendChild(elink);
  elink.click();
  URL.revokeObjectURL(elink.href);
  document.body.removeChild(elink);
}
