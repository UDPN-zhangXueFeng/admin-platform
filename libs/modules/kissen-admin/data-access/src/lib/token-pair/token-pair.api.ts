/**
 * Token 对域 raw API 层（源 `api/token-pair.ts` 逐字对照）。
 *
 * 上游 list 端点直返 `TokenPairRow[]`（非 PageResult 分页包体），故不走
 * kissenPage，直接 kissenRequest.post 解包数组。启停**即时生效不走审批**。
 */
import type { AxiosRequestConfig } from 'axios';

import { kissenRequest } from '../kissen-client';
import type {
  TokenPairListFilter,
  TokenPairRow,
  TokenPairSaveReq,
} from './token-pair.model';

/** Token 对列表（POST /manage/token-pair/list，直返数组）。 */
export function getTokenPairList(
  filter: TokenPairListFilter = {},
  config?: AxiosRequestConfig,
): Promise<TokenPairRow[]> {
  return kissenRequest.post<TokenPairRow[]>('/manage/token-pair/list', filter, config);
}

/** 新建/编辑（POST /manage/token-pair/save，pairCode 服务端生成）。 */
export function saveTokenPair(
  req: TokenPairSaveReq,
  config?: AxiosRequestConfig,
): Promise<{ pairId: number; pairCode: string }> {
  return kissenRequest.post('/manage/token-pair/save', req, config);
}

/** 启用（POST /manage/token-pair/{pairId}/enable，即时生效）。 */
export function enableTokenPair(pairId: number, config?: AxiosRequestConfig): Promise<void> {
  return kissenRequest.post(`/manage/token-pair/${pairId}/enable`, undefined, config);
}

/** 停用（POST /manage/token-pair/{pairId}/disable；存在生效 LP 参与时后端拒绝）。 */
export function disableTokenPair(pairId: number, config?: AxiosRequestConfig): Promise<void> {
  return kissenRequest.post(`/manage/token-pair/${pairId}/disable`, undefined, config);
}

/** 调整默认分成（POST /manage/token-pair/default-split，0~1 小数）。 */
export function setTokenPairDefaultSplit(
  req: { pairId: number; defaultSplitRatio: string | number },
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/manage/token-pair/default-split', req, config);
}
