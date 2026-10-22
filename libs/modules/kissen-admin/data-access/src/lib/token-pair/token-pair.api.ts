/**
 * Token 对域 API（源 `api/token-pair.ts`）。
 * 列表使用 Kissen `{page, data}` 请求体与 PageResult 响应；启停即时生效，
 * 建对/改参走 KPT/KRC 审批（2023418，default-split 直改退役）。
 */
import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-client';
import type {
  TokenPairChangeReq,
  TokenPairListFilter,
  TokenPairListReq,
  TokenPairRow,
  TokenPairSaveReq,
} from './token-pair.model';

/** Token 对分页列表（POST /manage/token-pair/list）。 */
export function getTokenPairList(
  req: TokenPairListReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<TokenPairRow>> {
  return kissenPage<TokenPairRow, TokenPairListFilter>(
    '/manage/token-pair/list',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

/**
 * Opening request (POST /manage/token-pair/save; source 2023418: submission
 * enters KPT approval and only takes effect once approved). Rejected
 * combinations are re-submitted on the same source+target row.
 */
export function saveTokenPair(
  req: TokenPairSaveReq,
  config?: AxiosRequestConfig,
): Promise<{ pairId: number; pairCode: string }> {
  return kissenRequest.post('/manage/token-pair/save', req, config);
}

/** Parameter-change request (POST /manage/token-pair/change; KRC approval, applied once approved). */
export function changeTokenPair(
  req: TokenPairChangeReq,
  config?: AxiosRequestConfig,
): Promise<{ pairId: number; pairCode: string }> {
  return kissenRequest.post('/manage/token-pair/change', req, config);
}

/** 启用（POST /manage/token-pair/{pairId}/enable，即时生效）。 */
export function enableTokenPair(pairId: number, config?: AxiosRequestConfig): Promise<void> {
  return kissenRequest.post(`/manage/token-pair/${pairId}/enable`, undefined, config);
}

/** 停用（POST /manage/token-pair/{pairId}/disable；存在生效 LP 参与时后端拒绝）。 */
export function disableTokenPair(pairId: number, config?: AxiosRequestConfig): Promise<void> {
  return kissenRequest.post(`/manage/token-pair/${pairId}/disable`, undefined, config);
}

