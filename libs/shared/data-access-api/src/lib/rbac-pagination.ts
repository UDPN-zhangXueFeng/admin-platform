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
 * 请求体遵循 RBAC `DataTable` DTO：`{ page: { pageNum, pageSize }, data }`。
 */
export async function getRbacPaginated<T, P = unknown>(
  url: string,
  params: P,
  config?: ApiRequestConfig
): Promise<PaginatedResponse<T>> {
  const {
    page: pageNum = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    ...data
  } = (params ?? {}) as { page?: number; pageSize?: number };
  const apiParams = {
    page: { pageNum, pageSize },
    data,
  };
  const raw = await apiClient.post<RbacListData<T>>(url, apiParams, config);

  const rows = raw?.rows ?? [];
  const total = raw?.page?.total ?? 0;
  const responsePageSize = raw?.page?.pageSize ?? DEFAULT_PAGE_SIZE;
  const page = raw?.page?.pageNum ?? 1;

  return {
    code: 0,
    data: rows,
    message: 'ok',
    pagination: {
      page,
      pageSize: responsePageSize,
      total,
      totalPages:
        responsePageSize > 0
          ? Math.max(1, Math.ceil(total / responsePageSize))
          : 1,
    },
  };
}
