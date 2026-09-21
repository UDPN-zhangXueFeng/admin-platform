'use client';

/**
 * LP 系统用户域 read-query hooks。
 *
 * keepPreviousData：翻页/改筛选重取期间保留上次成功数据（源 rows 不清空、
 * 拦截器 toast 后旧表保留的等价）；错误不吞，由 lp-client 拦截器统一提示。
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { userKeys } from './user.keys';
import { getUserPage } from './user.api';
import type { UserPageReq } from './user.model';

/** 用户分页列表（POST /lp/user/page）。 */
export function useUserPageQuery(projectId: string, params: UserPageReq) {
  return useQuery({
    queryKey: userKeys.list(projectId, params),
    queryFn: ({ signal }) => getUserPage(params, { signal }),
    placeholderData: keepPreviousData,
  });
}
