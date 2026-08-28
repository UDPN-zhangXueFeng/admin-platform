'use client';

/** Token 管理域 read-query hooks。 */
import { useQuery } from '@tanstack/react-query';

import { tokenList } from './token.api';
import { tokenKeys } from './token.keys';
import type { TokenListFilter } from './token.model';

/**
 * Token 列表（裸数组，无分页；过滤条件即缓存键，过滤变化取新 key）。
 * 跨组契约：FxAgent 的建对弹窗以 `tokenList({ status: 20 })` 取组合来源。
 */
export function useTokenListQuery(
  projectId: string,
  filter: TokenListFilter,
  enabled = true,
) {
  return useQuery({
    queryKey: tokenKeys.list(projectId, filter),
    queryFn: ({ signal }) => tokenList(filter, { signal }),
    enabled,
  });
}
