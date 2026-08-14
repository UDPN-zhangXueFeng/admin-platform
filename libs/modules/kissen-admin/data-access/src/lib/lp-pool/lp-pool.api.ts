/**
 * LP 资金池域 raw API 层（源 `api/lp-pool.ts`）。
 *
 * LP 列表选项以薄调用方式落在本域，避免并行耦合他组 data-access。
 */
import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-client';
import type { LpOption } from '../lp';
import {
  type LpPoolListFilter,
  type LpPoolListReq,
  type LpPoolRow,
  type LpPoolSaveReq,
} from './lp-pool.model';

/** 资金池分页列表（POST /manage/lp-pool/list）。 */
export function getLpPoolList(
  req: LpPoolListReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<LpPoolRow>> {
  return kissenPage<LpPoolRow, LpPoolListFilter>(
    '/manage/lp-pool/list',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

/** 新增/编辑（POST /manage/lp-pool/save）。 */
export function saveLpPool(
  req: LpPoolSaveReq,
  config?: AxiosRequestConfig,
): Promise<{ poolId: number }> {
  return kissenRequest.post('/manage/lp-pool/save', req, config);
}

/** LP 选项（薄调用 POST /manage/lp/list；跨组 lp 域，端点读源 api/lp.ts）。 */
export async function getLpPoolLpOptions(
  config?: AxiosRequestConfig,
): Promise<LpOption[]> {
  const res = await kissenPage<LpOption, Record<string, unknown>>(
    '/manage/lp/list',
    { pageNum: 1, pageSize: 200 },
    config,
  );
  return res.data;
}
