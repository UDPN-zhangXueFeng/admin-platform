/**
 * LP 资金池域 raw API 层。页面只消费 `/pool/list`（2026-09-11 3a57bbd 只读
 * 快照化：/pool/apply 与 /pool/activate 端点后端保留，门户无调用方，
 * data-access 定义已剪除）。
 */
import type { AxiosRequestConfig } from 'axios';

import { lpRequest } from '../lp-client';
import type { PoolRow } from './pool.model';

/** 资金池列表（不分页全量，body {}）。 */
export function getPoolList(config?: AxiosRequestConfig): Promise<PoolRow[]> {
  return lpRequest.post<PoolRow[]>('/pool/list', {}, config);
}
