/**
 * LP 货币对与资金池域 raw API 层（源 `src/api/pair.ts` 1:1）。
 *
 * 路径经 lp-client baseURL 拼 /lp 前缀（POST /lp/pair/list、
 * POST /lp/pair-pool/list）；lpId 由 BFF 登录域注入，前端不传。
 * 能力判定 capable 与缺口 gaps 由 api 侧计算（FR-P-10），前端只渲染。
 */
import type { AxiosRequestConfig } from 'axios';

import { lpRequest } from '../lp-client';
import type { PairPoolAgg, PairRow } from '../types';

/** 货币对参与清单（不分页全量，body {}）。 */
export function getPairList(config?: AxiosRequestConfig): Promise<PairRow[]> {
  return lpRequest.post<PairRow[]>('/pair/list', {}, config);
}

/** 货币对资金池聚合（不分页全量，body {}；页面按 pairId 建 Map O(1) 查）。 */
export function getPairPoolList(
  config?: AxiosRequestConfig,
): Promise<PairPoolAgg[]> {
  return lpRequest.post<PairPoolAgg[]>('/pair-pool/list', {}, config);
}
