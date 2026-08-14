/**
 * LP 预授权域 raw API 层（源 `api/lp-preauth.ts`）。
 *
 * LP / 资金池选项以薄调用方式落在本域，避免并行耦合他组 data-access。
 */
import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-client';
import type { LpOption } from '../lp';
import type { LpPoolOption } from '../lp-pool';
import {
  type LpPreauthListFilter,
  type LpPreauthListReq,
  type LpPreauthRow,
  type LpPreauthSaveReq,
} from './lp-preauth.model';

/** 预授权分页列表（POST /manage/lp-preauth/list）。 */
export function getLpPreauthList(
  req: LpPreauthListReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<LpPreauthRow>> {
  return kissenPage<LpPreauthRow, LpPreauthListFilter>(
    '/manage/lp-preauth/list',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

/** 新增/编辑（POST /manage/lp-preauth/save）。 */
export function saveLpPreauth(
  req: LpPreauthSaveReq,
  config?: AxiosRequestConfig,
): Promise<{ preauthId: number }> {
  return kissenRequest.post('/manage/lp-preauth/save', req, config);
}

/** 撤销（仅 status=20；POST /manage/lp-preauth/revoke）。 */
export function revokeLpPreauth(
  preauthId: number,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post(
    '/manage/lp-preauth/revoke',
    { preauthId },
    config,
  );
}

/** LP 选项（薄调用 POST /manage/lp/list；跨组 lp 域）。 */
export async function getLpPreauthLpOptions(
  config?: AxiosRequestConfig,
): Promise<LpOption[]> {
  const res = await kissenPage<LpOption, Record<string, unknown>>(
    '/manage/lp/list',
    { pageNum: 1, pageSize: 200 },
    config,
  );
  return res.data;
}

/**
 * 资金池选项（按 lpId 联动；薄调用 POST /manage/lp-pool/list，filter.lpId 选填）。
 */
export async function getLpPreauthPoolOptions(
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
