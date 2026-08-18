/**
 * rate 域 raw API 层（源 `src/api/rate.ts` 1:1）。
 */
import type { AxiosRequestConfig } from 'axios';

import { lpRequest } from '../lp-client';
import type { RateRow } from '../types';
import type { RateListReq } from './rate.model';

/**
 * 汇率列表（POST /lp/rate/list；不分页，全量返回）。
 *
 * 源 `rate.list`：`req: { pairId?: number } = {}`——pairId 入参保留但汇率页
 * 从不传（全量拉取后客户端过滤）；lpId 由 BFF 登录域注入，前端不传。
 */
export function rateList(
  req: RateListReq = {},
  config?: AxiosRequestConfig,
): Promise<RateRow[]> {
  return lpRequest.post<RateRow[]>('/rate/list', req, config);
}
