/**
 * Token 域 raw API 层（源 `api/token.ts`，四端点）。
 */
import type { AxiosRequestConfig } from 'axios';

import { kissenRequest } from '../kissen-gateway-client';
import type { TokenInfo, TokenSubmitReq, TokenSubmitResp } from './token.model';

/** 本实例已注册 token 列表（GET /token/list，纯本地表倒序）。 */
export function getTokenList(
  config?: AxiosRequestConfig,
): Promise<TokenInfo[]> {
  return kissenRequest.get<TokenInfo[]>('/token/list', config);
}

/** 同步申请状态（POST /token/refresh，上行 Kissen apply/list 拉取权威状态并回写本地后返回）。 */
export function refreshTokens(config?: AxiosRequestConfig): Promise<TokenInfo[]> {
  return kissenRequest.post<TokenInfo[]>('/token/refresh', undefined, config);
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
