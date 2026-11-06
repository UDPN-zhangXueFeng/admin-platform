/**
 * LP 资金池域 raw API 层（源 `api/lp-pool.ts`）。
 * 监控视图只读；2026-11-04 起「独立开通/编辑资金池」入口下线（后端 /lp-pool/save 已移除）——
 * 资金池只跟着 token 对走，由参与对审批通过时按两侧地址物化。
 */
import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-client';
import type { LpOnboardPair } from '../lp/lp.model';
import type { LpPoolPrecheckResp, LpPoolRow } from './lp-pool.model';

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

/**
 * 余额预检（POST /manage/lp-pool/precheck，源 16a3b8f）：
 * lpId 存在时并入该 LP 已生效参与对的累计门槛；allPass=false 阻断提交。
 */
export function lpPoolPrecheck(
  req: { lpId?: number; pairs: LpOnboardPair[] },
  config?: AxiosRequestConfig,
): Promise<LpPoolPrecheckResp> {
  return kissenRequest.post('/manage/lp-pool/precheck', req, config);
}
