import axios, { type AxiosError, type AxiosRequestConfig } from 'axios';

import { getLoginRedirectPath } from '@myorg/shared/util-auth';
import type { PaginatedResponse } from '@myorg/shared/model';
import { clearGatewaySession, getGatewayToken } from './auth/auth.session';

/**
 * kissen-gateway 应用固定 projectId（query key 隔离 / config 消费用，
 * 与 kissen-admin 的 KISSEN_PROJECT_ID 同模式）。
 */
export const KISSEN_GATEWAY_PROJECT_ID = 'kissen-gateway';

/**
 * Kissen 银行门户专用请求客户端。
 *
 * 忠实移植源 `src/api/request.ts` 的语义：
 * - baseURL `/bankgw/portal`（目标经 next.config rewrite 走 `/kissen-api` 前缀）
 * - 请求头 `token`（登录后携带）
 * - ResultInfo 包体 `code === '0'` 才成功，成功解包返回 `data`
 * - 401 清会话回登录页（`?expired=1`）；403「无权限执行该操作」
 *
 * 与 `@myorg/shared/data-access-api` 的 `apiClient` 并存：后者按数字
 * `code === 0` 判定成功，与 kissen 字符串 '0' 约定不兼容，不可混用。
 */
const KISSEN_GATEWAY_BASE_URL =
  typeof process !== 'undefined'
    ? (process.env['NEXT_PUBLIC_API_BASE_URL'] ?? '/kissen-api/bankgw/portal')
    : '/kissen-api/bankgw/portal';

export const kissenGatewayAxios = axios.create({
  baseURL: KISSEN_GATEWAY_BASE_URL,
  timeout: 15000,
});

kissenGatewayAxios.interceptors.request.use((config) => {
  const token = getGatewayToken();
  if (token) {
    config.headers.set('token', token);
  }
  return config;
});

/**
 * kissen 网关业务错误（`code !== '0'` 或 HTTP 层 401/403/网络异常）。
 * 携带 `traceId` 便于排障。
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

/**
 * 后端错误 message 可能为中文（如「未登录或登录已过期」）；本门户约束用户可见
 * 文案零中文。英文原样透传；空缺或含 CJK 时以 code 维度兜底（traceId 仍由
 * KissenApiError 拼接保留，排障不丢）。
 */
export function sanitizeKissenMessage(
  message: string | undefined,
  code: string,
): string {
  const text = message?.trim();
  if (!text) return `Request failed (code ${code})`;
  return /[\u4e00-\u9fff]/.test(text) ? `Request failed (code ${code})` : text;
}

function isKissenResult(body: unknown): body is KissenResult<unknown> {
  return (
    typeof body === 'object' &&
    body !== null &&
    'code' in body &&
    typeof (body as Record<string, unknown>).code === 'string'
  );
}

kissenGatewayAxios.interceptors.response.use(
  (response) => {
    const body = response.data;
    // 成功：code === '0'，解包返回 data。
    if (isKissenResult(body)) {
      if (body.code === '0') return body.data;
      // 实测（87 后端，2026-08-27）：未登录与失效 token 均为 HTTP 200 + code '2'
      // （后端不发 401，两侧旧 401 跳转分支皆为死代码）。与 401 分支同语义：
      // 清会话、跳登录并标记 expired（源 request.ts 401 分支的预期链路在此接通）。
      if (body.code === '2') {
        clearGatewaySession();
        if (typeof window !== 'undefined') {
          window.location.assign(`${getLoginRedirectPath()}?expired=1`);
        }
        throw new KissenApiError('2', 'Session expired. Please sign in again', body.traceId);
      }
      throw new KissenApiError(body.code, sanitizeKissenMessage(body.message, body.code), body.traceId);
    }
    // 非标准包体（如文件下载）原样返回。
    return body;
  },
  (error: AxiosError<unknown>) => {
    const status = error.response?.status;
    if (status === 401) {
      // 与源一致：清会话、跳登录并标记 expired（登录页据此展示「登录已失效」，
      // 源 request.ts 401 分支 + login/index.vue expired 提示的语义）。
      clearGatewaySession();
      if (typeof window !== 'undefined') {
        window.location.assign(`${getLoginRedirectPath()}?expired=1`);
      }
      throw new KissenApiError('401', 'Session expired. Please sign in again');
    }
    if (status === 403) {
      throw new KissenApiError('403', 'You do not have permission to perform this action');
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
    kissenGatewayAxios.get(url, config) as unknown as Promise<T>,
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    kissenGatewayAxios.post(url, data, config) as unknown as Promise<T>,
};
