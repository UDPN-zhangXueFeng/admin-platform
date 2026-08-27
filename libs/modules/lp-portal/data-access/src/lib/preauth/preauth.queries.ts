'use client';

/**
 * LP 预授权域 read-query hooks（pair 域同模式）。
 *
 * 页面挂载即激活（源 onMounted 同时拉列表 + 池下拉，两侧互不依赖——池下拉
 * 归 pool 域 hook）；0024 不重试立即呈现，其余错误沿用共享 QueryClient
 * 策略（pair 域同款 retryNotServiceDown，豁免降级码被当未知错误重试）。
 */
import { useQuery } from '@tanstack/react-query';

import { isServiceDown } from '../lp-client';
import { getPreauthList } from './preauth.api';
import { preauthKeys } from './preauth.keys';
import type { PreauthListReq } from './preauth.model';

const retryNotServiceDown = (failureCount: number, error: unknown): boolean =>
  failureCount < 2 && !isServiceDown(error);

/** 预授权快照列表（req 参与 key 身份，切筛选独立缓存条目）。 */
export function usePreauthListQuery(
  projectId: string,
  req: PreauthListReq = {},
  enabled = true,
) {
  return useQuery({
    queryKey: preauthKeys.list(projectId, req),
    queryFn: ({ signal }) => getPreauthList(req, { signal }),
    retry: retryNotServiceDown,
    enabled,
  });
}
