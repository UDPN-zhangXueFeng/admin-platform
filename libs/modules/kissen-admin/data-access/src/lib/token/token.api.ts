import type { AxiosRequestConfig } from 'axios';

import { kissenRequest } from '../kissen-client';
import type {
  TokenApproveReq,
  TokenListFilter,
  TokenRejectReq,
  TokenRow,
} from './token.model';

/**
 * Token 列表（POST /manage/token/list）。
 * body 为过滤对象直传（无 page 包装），返回裸数组，无分页。
 */
export function tokenList(
  data: TokenListFilter,
  config?: AxiosRequestConfig,
): Promise<TokenRow[]> {
  return kissenRequest.post<TokenRow[]>('/manage/token/list', data, config);
}

/** 审核通过并分配 tokenNo（POST /manage/token/approve）。 */
export function tokenApprove(
  req: TokenApproveReq,
  config?: AxiosRequestConfig,
): Promise<{ tokenNo: string }> {
  return kissenRequest.post<{ tokenNo: string }>(
    '/manage/token/approve',
    req,
    config,
  );
}

/** 驳回注册（POST /manage/token/reject）。 */
export function tokenReject(
  req: TokenRejectReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/manage/token/reject', req, config);
}

/** 调整最低流动性（POST /manage/token/min-liquidity/{tokenId}，body {minLiquidity}）。 */
export function tokenAdjustMinLiquidity(
  tokenId: number,
  minLiquidity: string | number,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post(
    `/manage/token/min-liquidity/${tokenId}`,
    { minLiquidity },
    config,
  );
}

/** 停用（POST /manage/token/{tokenId}/disable；仅 status=20 可见）。 */
export function tokenDisable(
  tokenId: number,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post(`/manage/token/${tokenId}/disable`, undefined, config);
}

/** 启用（POST /manage/token/{tokenId}/enable；仅 status=50 可见）。 */
export function tokenEnable(
  tokenId: number,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post(`/manage/token/${tokenId}/enable`, undefined, config);
}
