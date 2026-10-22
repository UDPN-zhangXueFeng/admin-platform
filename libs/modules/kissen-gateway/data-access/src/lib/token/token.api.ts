/**
 * Token 域 raw API 层（源 `api/token.ts`）。
 * 2026-10-13 分页清单：/token/list 与 /token/operate-logs/{tokenCode} 改
 * POST 服务端分页（kissenPage）；/token/refresh 响应变更为回写条数 int；
 * 新增 GET /token/filter-options 下拉主数据。
 */
import type { AxiosRequestConfig } from 'axios';

import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-gateway-client';
import type {
  TokenFilterOptions,
  TokenInfo,
  TokenOperationLogsPageReq,
  TokenOperationRecord,
  TokenPageReq,
  TokenSubmitReq,
  TokenSubmitResp,
} from './token.model';

/** /token/filter-options 原始响应（实测 data 形状：两个字符串数组）。 */
interface TokenFilterOptionsWire {
  chainTypes?: unknown;
  anchorFiats?: unknown;
}

/** 字符串数组安全提取（非数组/非字符串元素丢弃 → 空集合）。 */
function stringArrayOf(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : [];
}

/** token 分页列表（POST /token/list，tokenCode 模糊 / 其余精确）。 */
export function getTokenList(
  req: TokenPageReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<TokenInfo>> {
  return kissenPage<TokenInfo, NonNullable<TokenPageReq['filter']>>(
    '/token/list',
    req,
    config,
  );
}

/** 同步申请状态（POST /token/refresh；data=本次回写条数，0 也是成功）。 */
export function refreshTokens(config?: AxiosRequestConfig): Promise<number> {
  return kissenRequest.post<number>('/token/refresh', undefined, config);
}

/** token 注册/驳回后重提（POST /token/submit，本地落待审核 + 上行 Kissen）。 */
export function submitToken(
  data: TokenSubmitReq,
  config?: AxiosRequestConfig,
): Promise<TokenSubmitResp> {
  return kissenRequest.post<TokenSubmitResp>('/token/submit', data, config);
}

/** token 详情（GET /token/detail/{tokenCode}，仅本行本实例可见；无匹配返回 null）。tokenCode 路径段须 encodeURIComponent。 */
export function getTokenDetail(
  tokenCode: string,
  config?: AxiosRequestConfig,
): Promise<TokenInfo | null> {
  return kissenRequest.get<TokenInfo | null>(
    `/token/detail/${encodeURIComponent(tokenCode)}`,
    config,
  );
}

/** Token 操作留痕分页（POST /token/operate-logs/{tokenCode}）。 */
export function getTokenOperationLogs(
  tokenCode: string,
  req: TokenOperationLogsPageReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<TokenOperationRecord>> {
  return kissenPage<TokenOperationRecord>(
    `/token/operate-logs/${encodeURIComponent(tokenCode)}`,
    req,
    config,
  );
}

/** Token 筛选下拉主数据（GET /token/filter-options）。集合元素即提交值。 */
export async function getTokenFilterOptions(
  config?: AxiosRequestConfig,
): Promise<TokenFilterOptions> {
  const raw = await kissenRequest.get<TokenFilterOptionsWire>(
    '/token/filter-options',
    config,
  );
  return {
    chainTypes: stringArrayOf(raw?.chainTypes),
    anchorFiats: stringArrayOf(raw?.anchorFiats),
  };
}
