import { apiClient } from './api-client';
import type { ApiRequestConfig } from './axios-client';
import type { PaginatedResponse } from '@myorg/shared/model';

/**
 * 后端 RBAC list 接口 `envelope.data` 的真实结构。
 *
 * 与 td-manage `CustomTable`（`dataSource={tableData?.rows}`、`total={tableData?.page?.total}`）
 * 解析一致：sys 域所有 listPage 接口（`/api/rbac/v1/.../list*`）返回 `{rows, page}` 形状，
 * 而非前端约定的 `PaginatedResponse`。本模块负责 `{rows, page}` → `PaginatedResponse` 适配。
 */
export interface RbacListData<T> {
  rows?: T[];
  page?: {
    total?: number;
    pageSize?: number;
    pageNum?: number;
  };
}

/** 后端 `page.pageSize` 缺失时的回退值。 */
const DEFAULT_PAGE_SIZE = 10;

/**
 * 发送 RBAC list 请求并把后端 `{rows, page}` 响应转换为前端 `PaginatedResponse`。
 *
 * 用于 sys 域所有 listPage 接口（syslog/role/user/workflow 的列表）。转换规则：
 *   - `rows`               → `data`
 *   - `page.total`         → `pagination.total`
 *   - `page.pageSize`      → `pagination.pageSize`
 *   - `page.pageNum`       → `pagination.page`
 *   - `totalPages`         → 由 `total / pageSize` 向上取整（至少 1）
 *
 * 后端返回 `data: null`（如未授权 code=3）时，`raw` 为 null，结果为空分页（不抛错，
 * 由上层 query 的 error 态/响应拦截器处理认证）。
 */
export async function getRbacPaginated<T, P = unknown>(
  url: string,
  params: P,
  config?: ApiRequestConfig
): Promise<PaginatedResponse<T>> {
  // 后端 RBAC listPage 约定分页字段为 pageNum/pageSize（同 td-manage CustomTable 约定）。
  // 前端 PaginationParams 用 page，此处适配，避免字段名不匹配导致后端返回空数据。
  const { page: pageParam, ...rest } = (params ?? {}) as { page?: number };
  const apiParams = (pageParam !== undefined ? { ...rest, pageNum: pageParam } : rest) as P;
  const raw = await apiClient.post<RbacListData<T>>(url, apiParams, config);

  const rows = raw?.rows ?? [];
  const total = raw?.page?.total ?? 0;
  const pageSize = raw?.page?.pageSize ?? DEFAULT_PAGE_SIZE;
  const page = raw?.page?.pageNum ?? 1;

  return {
    code: 0,
    data: rows,
    message: 'ok',
    pagination: {
      page,
      pageSize,
      total,
      totalPages:
        pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1,
    },
  };
}
