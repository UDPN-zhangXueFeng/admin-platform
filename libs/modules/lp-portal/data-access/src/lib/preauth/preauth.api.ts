/**
 * LP 预授权域 raw API 层（源 `src/api/preauth.ts` 1:1）。
 *
 * 路径经 lp-client baseURL 拼 /lp 前缀（POST /lp/preauth/list）；
 * lpId 由 BFF 登录域注入，前端不传。只读快照，无提交端点（工作清单
 * 禁臆造接口）。响应非 ResultData 包裹的行数组，lpRequest 拦截器对无
 * code 字段的包体原样透传（lp-client.ts「非标准包体」分支），直读即可。
 */
import type { AxiosRequestConfig } from 'axios';

import { lpRequest } from '../lp-client';
import type { PreauthListReq, PreauthRow } from './preauth.model';

/** 预授权快照列表（不分页全量；body 缺省 {}，poolId undefined 不进请求体）。 */
export function getPreauthList(
  req: PreauthListReq = {},
  config?: AxiosRequestConfig,
): Promise<PreauthRow[]> {
  return lpRequest.post<PreauthRow[]>('/preauth/list', req, config);
}
