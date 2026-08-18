import axios, { type AxiosError, type AxiosRequestConfig } from 'axios';
import { toast } from 'sonner';

import { getLoginRedirectPath } from '@myorg/shared/util-auth';
import type { PaginatedResponse } from '@myorg/shared/model';

import { clearLpSession, getLpToken } from './auth/auth.session';

/**
 * LP Portal 应用固定 projectId（query key 隔离维度，消费方传参用，
 * 与 kissen-admin 的 KISSEN_PROJECT_ID 同模式）。
 */
export const LP_PROJECT_ID = 'lp-portal';

/**
 * LP Portal 专用请求客户端（源 `src/api/request.ts` 1:1 移植）。
 *
 * - baseURL `/lp`（BFF 前缀；dev 由 next.config rewrite 转发 8090，生产 Nginx 反代）
 * - token 放请求头 `token` 字段（不是 Authorization）
 * - ResultInfo 包体字符串 `code === '0'` 才成功，成功解包返回 `data`
 * - 401 清会话 + locale 前缀登录页 `?expired=1`；403「无权限执行该操作」toast
 * - `MSG_23_0024`（kissen-api 不可用降级码）静默 throw，不发全局 toast，
 *   由页面级 ServiceDownAlert 渲染降级条并保留旧数据
 *
 * 与 `@myorg/shared/data-access-api` 的 `apiClient` 并存：后者按数字
 * `code === 0` 判定成功，与 LP 字符串 '0' 约定不兼容（数字 0 会被放行吞错），
 * 不可混用。
 */
const LP_BASE_URL =
  typeof process !== 'undefined'
    ? (process.env['NEXT_PUBLIC_LP_API_BASE_URL'] ?? '/lp')
    : '/lp';

export const lpAxios = axios.create({
  baseURL: LP_BASE_URL,
  timeout: 15000,
});

lpAxios.interceptors.request.use((config) => {
  const token = getLpToken();
  if (token) {
    config.headers.set('token', token);
  }
  return config;
});

/**
 * toast 仅在浏览器侧发（拦截器本就只随客户端请求触发，SSR 下 sonner 无挂载点）。
 * 直接依赖 `sonner` 而非 `@myorg/shared/ui`：module-boundary 规定
 * type:data-access 只能依赖 data-access/util/model（shared/ui 是 type:ui），
 * 而 shared/ui 的 Toaster/toast 本就是 sonner 实例，此处同包直引即同一生效目标。
 */
function notifyError(message: string): void {
  if (typeof window !== 'undefined') {
    toast.error(message);
  }
}

/**
 * LP 业务错误（`code !== '0'` 或 HTTP 层 401/403/网络异常）。
 * 携带 `traceId` 便于排障；页面可经 {@link isServiceDown} 分流降级。
 */
export class LpApiError extends Error {
  readonly code: string;
  readonly traceId?: string;

  constructor(code: string, message: string, traceId?: string) {
    super(traceId ? `${message} (${traceId})` : message);
    this.name = 'LpApiError';
    this.code = code;
    this.traceId = traceId;
  }
}

/** LP 统一响应包体（成功时 code === '0'；源 types/result.ts ResultInfo）。 */
export interface LpResult<T = unknown> {
  code: string;
  message: string;
  data: T;
  traceId: string;
}

/** 分页响应（源 types/result.ts ResultData）。 */
export interface LpPageResult<T = unknown> {
  rows: T[];
  page: { total: number };
}

/** 分页请求体（源 types/result.ts DataTable）。 */
export interface LpPageReq<F = unknown> {
  page: { pageNum: number; pageSize: number };
  data: F;
}

/** kissen-api 不可用归一降级码（源 request.ts SERVICE_DOWN_CODE）。 */
export const SERVICE_DOWN_CODE = 'MSG_23_0024';

/**
 * 判定 `MSG_23_0024`（kissen-api 不可用）。页面级降级条据此分支：
 * 命中时保留已有数据、渲染 ServiceDownAlert（traceId 可从 err.traceId 取）。
 * 类型守卫签名与源一致（(err:unknown)=>err is {code,message?,traceId?}）。
 */
export function isServiceDown(
  err: unknown,
): err is { code: string; message?: string; traceId?: string } {
  return (
    !!err &&
    typeof err === 'object' &&
    (err as { code?: unknown }).code === SERVICE_DOWN_CODE
  );
}

/**
 * 通用分页 POST helper：源约定 `POST <url> { page:{pageNum,pageSize}, data: F }`
 * → `ResultData<T>{ rows, page:{total} }`，转成目标 {@link PaginatedResponse}。
 */
export async function lpPage<T, F = Record<string, unknown>>(
  url: string,
  opts: { pageNum: number; pageSize: number; filter?: F },
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<T>> {
  const raw = await lpRequest.post<LpPageResult<T>>(
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

function isLpResult(body: unknown): body is LpResult<unknown> {
  return (
    typeof body === 'object' &&
    body !== null &&
    'code' in body &&
    typeof (body as Record<string, unknown>).code === 'string'
  );
}

lpAxios.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (isLpResult(body)) {
      // 成功：code === '0'，解包返回 data（api 函数直接拿到业务数据）。
      if (body.code === '0') return body.data;
      const apiError = new LpApiError(body.code, body.message, body.traceId);
      // 0024 降级不发全局 toast，交由页面级 ServiceDownAlert 渲染（源语义）。
      if (!isServiceDown(apiError)) {
        notifyError(
          `${body.message ?? '请求失败'}${body.traceId ? ` (${body.traceId})` : ''}`,
        );
      }
      throw apiError;
    }
    // 非标准包体（如文件下载）原样返回。
    return body;
  },
  (error: AxiosError<unknown>) => {
    // 请求被主动取消（react-query 随切页/重挂载/新查询中止 AbortSignal）：
    // 非故障，不 toast，原样抛出由上层按取消语义忽略——否则每次导航都会
    // 弹「网络错误:canceled」噪音。
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
      throw error;
    }
    if (status === 401) {
      // 与源一致：清会话、跳登录并标记 expired（登录页据此展示「登录已失效」）；
      // 目标带 locale 前缀（getLoginRedirectPath 从当前路径解析 /en-US|/zh-CN）。
      clearLpSession();
      if (typeof window !== 'undefined') {
        window.location.assign(`${getLoginRedirectPath()}?expired=1`);
      }
      notifyError('登录已失效,请重新登录');
      throw new LpApiError('401', '登录已失效,请重新登录');
    }
    if (status === 403) {
      notifyError('无权限执行该操作');
      throw new LpApiError('403', '无权限执行该操作');
    }
    notifyError(`网络错误:${error.message}`);
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      throw new LpApiError('timeout', `网络超时:${error.message}`);
    }
    throw new LpApiError('network', `网络错误:${error.message}`);
  },
);

export interface LpRequest {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T>;
  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
}

/** 请求门面，方法直接返回解包后的 data（与源 request.ts 的 get/post 一致）。 */
export const lpRequest: LpRequest = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    lpAxios.get(url, config) as unknown as Promise<T>,
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    lpAxios.post(url, data, config) as unknown as Promise<T>,
};
