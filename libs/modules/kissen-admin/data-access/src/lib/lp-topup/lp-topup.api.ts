/**
 * LP 补资域 raw API 层（源 `api/lp-topup.ts`）。
 *
 * LP / 资金池选项以薄调用方式落在本域，避免并行耦合他组 data-access。
 */
import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-client';
import type { LpOption } from '../lp';
import type { LpPoolOption } from '../lp-pool';
import {
  type LpTopupListFilter,
  type LpTopupListReq,
  type LpTopupRow,
  type LpTopupSaveReq,
} from './lp-topup.model';

/** 补资分页列表（POST /manage/lp-topup/list）。 */
export function getLpTopupList(
  req: LpTopupListReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<LpTopupRow>> {
  return kissenPage<LpTopupRow, LpTopupListFilter>(
    '/manage/lp-topup/list',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

/** 声明补资（POST /manage/lp-topup/save）。 */
export function saveLpTopup(
  req: LpTopupSaveReq,
  config?: AxiosRequestConfig,
): Promise<{ topupId: number }> {
  return kissenRequest.post('/manage/lp-topup/save', req, config);
}

/** LP 选项（薄调用 POST /manage/lp/list；跨组 lp 域）。 */
export async function getLpTopupLpOptions(
  config?: AxiosRequestConfig,
): Promise<LpOption[]> {
  const res = await kissenPage<LpOption, Record<string, unknown>>(
    '/manage/lp/list',
    { pageNum: 1, pageSize: 200 },
    config,
  );
  return res.data;
}

/** 资金池选项（按 lpId 联动；薄调用 POST /manage/lp-pool/list，filter.lpId 选填）。 */
export async function getLpTopupPoolOptions(
  lpId: number | undefined,
  config?: AxiosRequestConfig,
): Promise<LpPoolOption[]> {
  const res = await kissenPage<LpPoolOption, { lpId?: number }>(
    '/manage/lp-pool/list',
    { pageNum: 1, pageSize: 200, filter: lpId != null ? { lpId } : {} },
    config,
  );
  return res.data;
}
