/**
 * LP 资金池域 raw API 层（源 `api/pool.ts`）。
 *
 * 路径经 lp-client baseURL 拼 /lp 前缀（POST /lp/pool/list）；lpId 由 BFF
 * 登录域注入，前端不传。`/lp/pool/detail/{poolId}` 端点源中无页面消费
 * （裁决 O-9），不建 api 函数。
 */
import type { AxiosRequestConfig } from 'axios';

import { lpRequest } from '../lp-client';
import type { PoolRow } from './pool.model';

/** 资金池列表（不分页全量，body {}）。 */
export function getPoolList(config?: AxiosRequestConfig): Promise<PoolRow[]> {
  return lpRequest.post<PoolRow[]>('/pool/list', {}, config);
}
