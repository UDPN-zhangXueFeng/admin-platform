/**
 * LP 域 raw API 层（源 `api/business.ts` lpList）。
 */
import type { AxiosRequestConfig } from 'axios';

import { kissenRequest } from '../kissen-gateway-client';
import type { LpItem } from './lp.model';

/**
 * LP 列表（GET /lp/list）。pairId 缺省时省略参数（后端返回全量），
 * 与源 `pairId != null ? { pairId } : {}` 的参数语义一致。
 */
export function getLpList(
  pairId?: number,
  config?: AxiosRequestConfig,
): Promise<LpItem[]> {
  return kissenRequest.get<LpItem[]>('/lp/list', {
    ...config,
    params: {
      ...config?.params,
      ...(pairId != null ? { pairId } : {}),
    },
  });
}
