/**
 * LP Token 对参与域 raw API 层（源 `src/api/pair.ts` 1:1，FR-LW-04）。
 *
 * 本地副本查询 + 实时申请三端点；路径经 lp-client baseURL 拼 /lp 前缀。
 * lpId 由后端登录态注入，前端不传。v1 聚合接口 POST /pair-pool/list 随
 * pair-pool 聚合页废弃，不再保留 api 函数（禁臆造，反向亦不留死端点）。
 */
import type { AxiosRequestConfig } from 'axios';

import { lpRequest } from '../lp-client';
import type { EligiblePairRow, PairRow } from './pair.model';

/** 我的 token 对列表（状态 + 生效分成比例；不分页全量，body {}）。 */
export function getPairList(config?: AxiosRequestConfig): Promise<PairRow[]> {
  return lpRequest.post<PairRow[]>('/pair/list', {}, config);
}

/** 可申请视图（全网生效对 + 两侧池开通态；不分页全量，body {}）。 */
export function getPairEligible(
  config?: AxiosRequestConfig,
): Promise<EligiblePairRow[]> {
  return lpRequest.post<EligiblePairRow[]>('/pair/eligible', {}, config);
}

/** Token 对参与申请（实时调 Kissen，KLP 审批；受理即推回流）。 */
export function postPairApply(
  pairId: number,
  config?: AxiosRequestConfig,
): Promise<{ id: number }> {
  return lpRequest.post<{ id: number }>('/pair/apply', { pairId }, config);
}
