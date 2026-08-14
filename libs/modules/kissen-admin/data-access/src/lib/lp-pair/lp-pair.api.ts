/**
 * LP 货币对域 raw API 层（源 `api/lp-pair.ts`）。
 *
 * LP 列表 / 货币对列表选项以薄调用方式落在本域，避免并行耦合他组 data-access。
 */
import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-client';
import type { CurrencyPairOption, LpOption } from '../lp';
import {
  type LpPairListFilter,
  type LpPairListReq,
  type LpPairRow,
  type LpPairSaveReq,
} from './lp-pair.model';

/** LP 货币对分页列表（POST /manage/lp-currency-pair/list）。 */
export function getLpPairList(
  req: LpPairListReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<LpPairRow>> {
  return kissenPage<LpPairRow, LpPairListFilter>(
    '/manage/lp-currency-pair/list',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

/** 新增/编辑（POST /manage/lp-currency-pair/save）。 */
export function saveLpPair(
  req: LpPairSaveReq,
  config?: AxiosRequestConfig,
): Promise<{ id: number }> {
  return kissenRequest.post('/manage/lp-currency-pair/save', req, config);
}

/** 提交（POST /manage/lp-currency-pair/submit）。 */
export function submitLpPair(
  id: number,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/manage/lp-currency-pair/submit', { id }, config);
}

/** 变更状态：停用(50)/恢复草稿(1)（POST /manage/lp-currency-pair/status）。 */
export function updateLpPairStatus(
  id: number,
  targetStatus: number,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post(
    '/manage/lp-currency-pair/status',
    { id, targetStatus },
    config,
  );
}

/** 物理删除（仅草稿/拒绝态；POST /manage/lp-currency-pair/remove）。 */
export function removeLpPair(
  id: number,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/manage/lp-currency-pair/remove', { id }, config);
}

/** LP 选项（薄调用 POST /manage/lp/list；跨组 lp 域，端点读源 api/lp.ts）。 */
export async function getLpPairLpOptions(
  config?: AxiosRequestConfig,
): Promise<LpOption[]> {
  const res = await kissenPage<LpOption, Record<string, unknown>>(
    '/manage/lp/list',
    { pageNum: 1, pageSize: 200 },
    config,
  );
  return res.data;
}

/** 货币对选项（薄调用 POST /manage/currency-pair/list；跨组 currency-pair 域）。 */
export async function getLpPairCurrencyPairOptions(
  config?: AxiosRequestConfig,
): Promise<CurrencyPairOption[]> {
  const res = await kissenPage<CurrencyPairOption, Record<string, unknown>>(
    '/manage/currency-pair/list',
    { pageNum: 1, pageSize: 200 },
    config,
  );
  return res.data;
}
