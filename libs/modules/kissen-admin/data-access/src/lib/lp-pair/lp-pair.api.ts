/**
 * LP×Token 对域 raw API 层（源 `api/lp-pair.ts`）。
 *
 * v2.0 端点整体切换：/manage/lp-**token**-pair/*（原 lp-currency-pair 已废弃）。
 * Token 对选项为跨组数据（token-pair 域），以薄调用落在本域避免并行耦合。
 * save/submit/remove 保留 API 层，供管理侧迁移后的 KLP 审批入口复用。
 */
import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest, type KissenPageResult } from '../kissen-client';
import type {
  LpPairRow,
  LpPairSubmitReq,
  LpPairTokenPairOption,
} from './lp-pair.model';
import type { LpPoolSide } from '../lp/lp.model';

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

/**
 * 提交参与对 KLP 审批（POST /manage/lp-token-pair/submit，2026-10-29 起全量 payload 原子
 * 提交）：后端余额预检+池/预授权前置全过才落库；仅已入网生效（20）LP 可用。
 */
export function submitLpPair(
  req: LpPairSubmitReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/manage/lp-token-pair/submit', req, config);
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

/**
 * 生效对参数变更申请（POST /manage/lp-token-pair/change，源 16a3b8f）：
 * KLP 审批，通过前现值继续服务，通过后物化 lp_pool；id 为 lp_token_pair 主键。
 */
export function changeLpPair(
  req: { id: number; source: LpPoolSide; target: LpPoolSide },
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/manage/lp-token-pair/change', req, config);
}

/** 移除（POST /manage/lp-token-pair/remove；仅 1/15，物理删除；页面无入口，API 层保留）。 */
export function removeLpPair(
  id: number,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/manage/lp-token-pair/remove', { id }, config);
}

/**
 * Token 对选项（POST /manage/token-pair/list，DataTable 分页口径——2026-09-29 后端
 * 分页化后扁平 body 报“分页参数不能为空”，2026-10-27 修正；status=20 供配池
 * 编辑器只列启用对，pageSize 取 200 覆盖全量选项）。
 */
export async function getLpPairTokenPairOptions(
  filter: { status?: number } = {},
  config?: AxiosRequestConfig,
): Promise<LpPairTokenPairOption[]> {
  const raw = await kissenRequest.post<KissenPageResult<LpPairTokenPairOption>>(
    '/manage/token-pair/list',
    { page: { pageNum: 1, pageSize: 200 }, data: filter },
    config,
  );
  return raw?.rows ?? [];
}
