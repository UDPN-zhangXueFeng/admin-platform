import axios, { type AxiosError, type AxiosRequestConfig } from 'axios';

import {
  clearSessionStorage,
  getAccessToken,
  getLoginRedirectPath,
} from '@myorg/shared/util-auth';
import type { PaginatedResponse } from '@myorg/shared/model';

/**
 * Kissen 专用请求客户端。
 *
 * 与 `@myorg/shared/data-access-api` 的 `apiClient` 并存：后者按数字 `code === 0`
 * 判定成功，而 kissen 网关遵循 `ResultInfo{ code: string, '0' = 成功 }`，两者
 * 约定不兼容（字符串 '0' 会被 shared-client 静默放行，错误被吞）。此处忠实移植
 * kissen 源 `src/api/request.ts` 的语义。
 */
const KISSEN_BASE_URL =
  typeof process !== 'undefined'
    ? (process.env['NEXT_PUBLIC_KISSEN_API_BASE_URL'] ?? '/v1')
    : '/v1';

export const kissenAxios = axios.create({
  baseURL: KISSEN_BASE_URL,
  timeout: 15000,
});

kissenAxios.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.set('token', token);
  }
  return config;
});

/**
 * kissen 网关业务错误（`code !== '0'`）。携带 `traceId` 便于排障。
 */
export class KissenApiError extends Error {
  readonly code: string;
  readonly traceId?: string;

  constructor(code: string, message: string, traceId?: string) {
    super(traceId ? `${message} (${traceId})` : message);
    this.name = 'KissenApiError';
    this.code = code;
    this.traceId = traceId;
  }
}

/** kissen 网关统一响应包体（成功时 code === '0'）。 */
export interface KissenResult<T = unknown> {
  code: string;
  message: string;
  data: T;
  traceId: string;
}

/** 分页响应（源 PageResult）。 */
export interface KissenPageResult<T = unknown> {
  rows: T[];
  page: { total: number };
}

/** 分页请求体（源 DataTable）。 */
export interface KissenPageReq<F = unknown> {
  page: { pageNum: number; pageSize: number };
  data: F;
}

/**
 * 通用分页 POST helper：源约定 `POST <url> { page:{pageNum,pageSize}, data: F }`
 * → `PageResult<T>{ rows, page:{total} }`，转成目标 {@link PaginatedResponse}。
 */
export async function kissenPage<T, F = Record<string, unknown>>(
  url: string,
  opts: { pageNum: number; pageSize: number; filter?: F },
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<T>> {
  const raw = await kissenRequest.post<KissenPageResult<T>>(
    url,
    {
      page: { pageNum: opts.pageNum, pageSize: opts.pageSize },
      data: opts.filter ?? ({} as F),
    },
    config,
  );
  const total = raw?.page?.total ?? 0;
  const pageSize = opts.pageSize;
  return {
    code: 0,
    message: 'ok',
    data: raw?.rows ?? [],
    pagination: {
      page: opts.pageNum,
      pageSize,
      total,
      totalPages: pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1,
    },
  };
}

function isKissenResult(body: unknown): body is KissenResult<unknown> {
  return (
    typeof body === 'object' &&
    body !== null &&
    'code' in body &&
    typeof (body as Record<string, unknown>).code === 'string'
  );
}

kissenAxios.interceptors.response.use(
  (response) => {
    const body = response.data;
    // 成功：code === '0'，解包返回 data。
    if (isKissenResult(body)) {
      if (body.code === '0') return body.data;
      // 业务 code === '2'：未登录/会话过期（源 request.ts 响应拦截器语义）——
      // 清会话并踢回登录页，与 HTTP 401 同径。
      if (body.code === '2') {
        clearSessionStorage();
        if (typeof window !== 'undefined') {
          window.location.assign(`${getLoginRedirectPath()}?expired=1`);
        }
        throw new KissenApiError('2', 'Session expired, please sign in again', body.traceId);
      }
      throw new KissenApiError(body.code, body.message, body.traceId);
    }
    // 非标准包体（如文件下载）原样返回。
    return body;
  },
  (error: AxiosError<unknown>) => {
    const status = error.response?.status;
    if (status === 401) {
      // 与源一致：清会话、跳登录并标记 expired（登录页据此展示「登录已失效」，
      // 源 request.ts:24-29 + login/index.vue:19-22 的语义）。
      clearSessionStorage();
      if (typeof window !== 'undefined') {
        window.location.assign(`${getLoginRedirectPath()}?expired=1`);
      }
      throw new KissenApiError('401', 'Session expired, please sign in again');
    }
    if (status === 403) {
      throw new KissenApiError('403', 'No permission to perform this operation');
    }
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      throw new KissenApiError('timeout', `Network timeout: ${error.message}`);
    }
    throw new KissenApiError('network', `Network error: ${error.message}`);
  },
);

export interface KissenRequest {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T>;
  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
}
/** 请求门面，方法直接返回解包后的 data（与源 request 对象一致）。 */
export const kissenRequest: KissenRequest = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    kissenAxios.get(url, config) as unknown as Promise<T>,
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    kissenAxios.post(url, data, config) as unknown as Promise<T>,
};
