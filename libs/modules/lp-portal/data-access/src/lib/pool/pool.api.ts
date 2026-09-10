/**
 * LP 资金池域 raw API 层。页面只消费 `/pool/list`；历史申请/切换端点保留供
 * 存量审批闭环使用，当前 Portal 页面不调用。
 */
import type { AxiosRequestConfig } from 'axios';

import { lpRequest } from '../lp-client';
import type { PoolApplyReq, PoolRow } from './pool.model';

/** 资金池列表（不分页全量，body {}）。 */
export function getPoolList(config?: AxiosRequestConfig): Promise<PoolRow[]> {
  return lpRequest.post<PoolRow[]>('/pool/list', {}, config);
}

/** 存量开池申请（KLPP 兼容接口；当前 Portal 页面不调用）。 */
export function postPoolApply(
  req: PoolApplyReq,
  config?: AxiosRequestConfig,
): Promise<{ poolId: number }> {
  return lpRequest.post<{ poolId: number }>('/pool/apply', req, config);
}

/** 存量出款池切换（兼容接口；当前业务概念已退役，页面不调用）。 */
export function postPoolActivate(
  poolId: number,
  config?: AxiosRequestConfig,
): Promise<{ inFlightCount: number }> {
  return lpRequest.post<{ inFlightCount: number }>(
    `/pool/activate/${poolId}`,
    {},
    config,
  );
}
