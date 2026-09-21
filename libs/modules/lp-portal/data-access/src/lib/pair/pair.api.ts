/**
 * LP Token 对参与域 raw API 层（源 `src/api/pair.ts`，FR-LW-04）。
 *
 * 本地副本查询端点；路径经 lp-client baseURL 拼 /lp 前缀。lpId 由后端登录态
 * 注入，前端不传。v1 聚合接口 POST /pair-pool/list 随 pair-pool 聚合页废弃
 * 剪除；2026-09-11 3a57bbd「可申请」视图与申请入口下线（方案 v1.4 决议⑤），
 * /pair/eligible 与 /pair/apply 端点后端保留但门户无调用方，api 定义已剪除。
 */
import type { AxiosRequestConfig } from 'axios';

import { lpRequest } from '../lp-client';
import type { PairRow } from './pair.model';

/** 我的 token 对列表（状态 + 生效分成比例；不分页全量，body {}）。 */
export function getPairList(config?: AxiosRequestConfig): Promise<PairRow[]> {
  return lpRequest.post<PairRow[]>('/pair/list', {}, config);
}
