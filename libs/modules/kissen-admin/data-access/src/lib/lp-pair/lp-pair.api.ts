/**
 * LP×Token 对域 raw API 层（源 `api/lp-pair.ts`）。
 *
 * v2.0 端点整体切换：/manage/lp-**token**-pair/*（原 lp-currency-pair 已废弃）。
 * Token 对选项为跨组数据（token-pair 域），以薄调用落在本域避免并行耦合。
 * save/submit/remove 保留 API 层（源注释：参与由 LP 门户发起，页面无入口）。
 */
import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-client';
import type {
  LpPairRow,
  LpPairSaveReq,
  LpPairTokenPairOption,
} from './lp-pair.model';

interface LpPairPageReq {
  pageNum: number;
  pageSize: number;
  filter: {
    lpId?: number;
    pairId?: number;
    status?: number;
    notApproved?: boolean;
  };
}

/** LP×Token 对分页列表（POST /manage/lp-token-pair/list）。 */
export function getLpPairList(
  req: LpPairPageReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<LpPairRow>> {
  return kissenPage<LpPairRow, LpPairPageReq['filter']>(
    '/manage/lp-token-pair/list',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

/** 新增/编辑草稿（POST /manage/lp-token-pair/save；页面无入口，API 层保留）。 */
export function saveLpPair(
  req: LpPairSaveReq,
  config?: AxiosRequestConfig,
): Promise<{ id: number }> {
  return kissenRequest.post('/manage/lp-token-pair/save', req, config);
}

/** 提交 KLP 审批（POST /manage/lp-token-pair/submit；页面无入口，API 层保留）。 */
export function submitLpPair(
  id: number,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/manage/lp-token-pair/submit', { id }, config);
}

/** 变更状态（POST /manage/lp-token-pair/status）：50 停用（仅 20）/ 1 恢复为草稿（仅 50）。 */
export function updateLpPairStatus(
  id: number,
  targetStatus: number,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post(
    '/manage/lp-token-pair/status',
    { id, targetStatus },
    config,
  );
}

/** 覆盖分成设置（POST /manage/lp-token-pair/split；仅 20；0=清除覆盖回落 token 对默认分成）。 */
export function setLpPairSplit(
  req: { id: number; splitRatio: string | number },
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/manage/lp-token-pair/split', req, config);
}

/** 移除（POST /manage/lp-token-pair/remove；仅 1/15，物理删除；页面无入口，API 层保留）。 */
export function removeLpPair(
  id: number,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/manage/lp-token-pair/remove', { id }, config);
}

/** Token 对选项（薄调用 POST /manage/token-pair/list，扁平 body 全量——源 api/token-pair.ts pairList）。 */
export async function getLpPairTokenPairOptions(
  config?: AxiosRequestConfig,
): Promise<LpPairTokenPairOption[]> {
  return kissenRequest.post<LpPairTokenPairOption[]>(
    '/manage/token-pair/list',
    {},
    config,
  );
}
