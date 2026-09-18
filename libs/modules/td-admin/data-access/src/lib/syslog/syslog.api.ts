import {
  apiClient,
  getRbacPaginated,
  type ApiRequestConfig,
} from '@myorg/shared/data-access-api';
import type { PaginatedResponse } from '@myorg/shared/model';
import type {
  SysLogItem,
  SysLogModuleOption,
  SysLogOperationTypeOption,
  SysLogQueryParams,
  SysLogUserOption,
} from './syslog.model';

const BASE = '/api/rbac/v1';

/**
 * 日志列表（分页 + 筛选）。对应旧页 `useCustomTable` 的 `url: '/api/rbac/v1/log/list'`。
 *
 * 注意：旧页用 SWR GET 风格，但同目录 `src/lib/api/sys-logs.ts` 已确认后端为 POST，
 * 故这里统一 POST（与 RBAC 服务其余 sys 接口风格一致）。
 */
export function getSysLogs(
  params: SysLogQueryParams,
  config?: ApiRequestConfig
): Promise<PaginatedResponse<SysLogItem>> {
  return getRbacPaginated<SysLogItem, SysLogQueryParams>(
    `${BASE}/log/list`,
    params,
    config
  );
}

/** 模块下拉数据，用于筛选与列渲染的 code→name 映射。 */
export function getSysLogModules(
  config?: ApiRequestConfig
): Promise<SysLogModuleOption[]> {
  return apiClient.post<SysLogModuleOption[]>(`${BASE}/log/modules`, {}, config);
}

/** 操作类型下拉数据，code 用于 i18n 文案查找。 */
export function getSysLogOperationTypes(
  config?: ApiRequestConfig
): Promise<SysLogOperationTypeOption[]> {
  return apiClient.post<SysLogOperationTypeOption[]>(
    `${BASE}/log/operation/types`,
    {},
    config
  );
}

/** 用户下拉数据，用于按操作人筛选。 */
export function getSysLogUsers(
  config?: ApiRequestConfig
): Promise<SysLogUserOption[]> {
  return apiClient.post<SysLogUserOption[]>(`${BASE}/user/list`, {}, config);
}
