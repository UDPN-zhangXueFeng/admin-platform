/**
 * 汇率域 raw API 层（源 `api/business.ts` latestRate）。
 */
import type { AxiosRequestConfig } from 'axios';

import { kissenRequest } from '../kissen-gateway-client';
import type { RateSnapshot } from './rate.model';

/**
 * 最新汇率快照（GET /rate/list）。pairId 缺省时省略参数，
 * 与源 `pairId != null ? { pairId } : {}` 的参数语义一致。
 */
export function getLatestRate(
  pairId?: number,
  config?: AxiosRequestConfig,
): Promise<RateSnapshot> {
  return kissenRequest.get<RateSnapshot>('/rate/list', {
    ...config,
    params: {
      ...config?.params,
      ...(pairId != null ? { pairId } : {}),
    },
  });
}
