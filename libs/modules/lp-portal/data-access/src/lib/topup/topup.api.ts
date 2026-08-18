/**
 * LP Portal 补资域 raw API 层（源 `src/api/topup.ts` + `src/api/pool.ts`）。
 *
 * - POST /lp/topup/list：分页列表（后端默认 declare_time DESC，前端不传排序）；
 * - POST /lp/pool/list：资金池下拉选项（源 views/topup loadPoolOptions，
 *   不分页、失败仅下拉为空不触发降级条）。资金池域属 pool 组，此处薄调用
 *   同后端端点而不 import pool 域，避免并行域耦合（kissen-admin 先例）。
 */
import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { lpPage, lpRequest } from '../lp-client';
import type { TopupListFilter, TopupListReq, TopupRow } from './topup.model';

/** 补资记录分页列表（POST /lp/topup/list；lpId 由 BFF 注入不传）。 */
export function getTopupList(
  req: TopupListReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<TopupRow>> {
  return lpPage<TopupRow, TopupListFilter>(
    '/topup/list',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

/** 资金池下拉选项行（源 types/business.ts PoolRow，本域仅消费展示字段）。 */
export interface TopupPoolOption {
  poolId: number;
  currency: string;
  accountAddress: string;
}

/**
 * 资金池选项（POST /lp/pool/list，不分页全量返回）。
 * 源语义：选项 label `${currency}(${maskAddress(accountAddress)})` 由页面拼装。
 */
export function getTopupPoolOptions(
  config?: AxiosRequestConfig,
): Promise<TopupPoolOption[]> {
  return lpRequest.post<TopupPoolOption[]>('/pool/list', {}, config);
}
