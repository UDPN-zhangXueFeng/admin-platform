/**
 * LP 资金池域 raw API 层（源 `api/pool.ts` list + apply）。
 * 登录域注入，前端不传。`/lp/pool/detail/{poolId}` 端点源中无页面消费
 * （裁决 O-9），不建 api 函数。
 *
 * apply 为实时调 Kissen 的开池申请（KLPP 审批；受理即推回流列表可见
 * 「Pending」，源注释同语义）。
 */
import type { AxiosRequestConfig } from 'axios';

import { lpRequest } from '../lp-client';
import type { PoolApplyReq, PoolRow } from './pool.model';

/** 资金池列表（不分页全量，body {}）。 */
export function getPoolList(config?: AxiosRequestConfig): Promise<PoolRow[]> {
  return lpRequest.post<PoolRow[]>('/pool/list', {}, config);
}

/** 开池申请（POST /pool/apply，返回受理的池 ID）。 */
export function postPoolApply(
  req: PoolApplyReq,
  config?: AxiosRequestConfig,
): Promise<{ poolId: number }> {
  return lpRequest.post<{ poolId: number }>('/pool/apply', req, config);
}
