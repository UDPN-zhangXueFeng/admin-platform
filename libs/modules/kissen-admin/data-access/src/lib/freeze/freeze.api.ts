import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-client';
import type {
  FreezeBankFilter,
  FreezeBankRow,
  FreezeLpFilter,
  FreezeLpRow,
  FreezeToggleReq,
} from './freeze.model';

/**
 * 冻结开关：立即生效，不走审批（规格 R-4）。
 * POST /manage/freeze/toggle；状态校验后端 MSG_21_0067 兜底（仅 20→50 / 50→20）。
 */
export function freezeToggle(
  req: FreezeToggleReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/manage/freeze/toggle', req, config);
}

/**
 * 银行分页列表（薄调用，供冻结列表聚合）。
 * 端点同源 api/bank.ts bankList：POST /manage/bank/list { page, data }。
 */
export function getFreezeBankList(
  req: { pageNum: number; pageSize: number; filter: FreezeBankFilter },
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<FreezeBankRow>> {
  return kissenPage<FreezeBankRow, FreezeBankFilter>(
    '/manage/bank/list',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

/**
 * LP 分页列表（薄调用，供冻结列表聚合）。
 * 端点同源 api/lp.ts lpList：POST /manage/lp/list { page, data }。
 */
export function getFreezeLpList(
  req: { pageNum: number; pageSize: number; filter: FreezeLpFilter },
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<FreezeLpRow>> {
  return kissenPage<FreezeLpRow, FreezeLpFilter>(
    '/manage/lp/list',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

