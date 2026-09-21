/**
 * LP 预授权域 raw API 层（源 `api/lp-preauth.ts`）。
 *
 * v2.0 收敛为只读快照：预授权的发起/撤销改由 LP 门户+资金系统独占，
 * 管理端不再提供 saveLpPreauth/revokeLpPreauth（源端点已随 v2 移除）。
 */
import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage } from '../kissen-client';
import type { LpPreauthRow } from './lp-preauth.model';

/** 预授权快照分页列表（POST /manage/lp-preauth/list）。 */
export function getLpPreauthList(
  req: {
    pageNum: number;
    pageSize: number;
    filter: { lpId?: number; poolId?: number; tokenId?: number; status?: number };
  },
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<LpPreauthRow>> {
  return kissenPage<LpPreauthRow, LpPreauthPageReq['filter']>(
    '/manage/lp-preauth/list',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

interface LpPreauthPageReq {
  pageNum: number;
  pageSize: number;
  filter: { lpId?: number; poolId?: number; tokenId?: number; status?: number };
}
