/**
 * LP 资金池域 raw API 层（源 `api/lp-pool.ts`）。
 * 监控视图只读；save 保留 API 层（页面无入口——池由 LP 门户申请，KLPP 审批）。
 */
import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-client';
import type { LpPoolRow, LpPoolSaveReq } from './lp-pool.model';

interface LpPoolPageReq {
  pageNum: number;
  pageSize: number;
  filter: { lpId?: number; tokenId?: number; status?: number };
}

/** 资金池分页列表（POST /manage/lp-pool/list）。 */
export function getLpPoolList(
  req: LpPoolPageReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<LpPoolRow>> {
  return kissenPage<LpPoolRow, LpPoolPageReq['filter']>(
    '/manage/lp-pool/list',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

/** 开通/编辑资金池（POST /manage/lp-pool/save；页面无入口，API 层保留）。 */
export function saveLpPool(
  req: LpPoolSaveReq,
  config?: AxiosRequestConfig,
): Promise<{ poolId: number }> {
  return kissenRequest.post('/manage/lp-pool/save', req, config);
}
