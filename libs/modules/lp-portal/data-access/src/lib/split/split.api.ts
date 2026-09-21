/**
 * LP 我的分成域 raw API 层（源 `src/api/split.ts` 1:1）。
 *
 * 路径经 lp-client baseURL 拼 /lp 前缀（POST /lp/split/list、
 * POST /lp/split/detail）；lpId 由 BFF 登录域注入，前端不传。
 */
import type { AxiosRequestConfig } from 'axios';

import { lpRequest } from '../lp-client';
import type {
  SplitDetailQuery,
  SplitDetailResp,
  SplitRow,
} from './split.model';

/** 当前生效比例列表（POST /lp/split/list body {}，不分页全量）。 */
export function getSplitRatios(
  config?: AxiosRequestConfig,
): Promise<SplitRow[]> {
  return lpRequest.post<SplitRow[]>('/split/list', {}, config);
}

/**
 * 分成明细分页（POST /lp/split/detail）。
 *
 * 请求体沿用源 DataTable 双包结构 `{page:{pageNum,pageSize}, data:F}`（与
 * lpPage 的出参形态同形）；**响应不走 ResultData 包装**——直出
 * {rows,total,pageNum,pageSize,summary}（迁移矩阵 C 表脚注 19），拦截器
 * 对无 code 字段的包体原样透传，故不经 lpPage 二次映射、直接返回原文体。
 */
export function getSplitDetail(
  req: SplitDetailQuery,
  config?: AxiosRequestConfig,
): Promise<SplitDetailResp> {
  return lpRequest.post<SplitDetailResp>(
    '/split/detail',
    {
      page: { pageNum: req.pageNum, pageSize: req.pageSize },
      data: req.filter ?? {},
    },
    config,
  );
}
