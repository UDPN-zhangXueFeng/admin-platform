'use client';

/** 解付 Spender 域 read-query hooks。 */
import { useQuery } from '@tanstack/react-query';

import { spenderList } from './disburse-spender.api';
import { disburseSpenderKeys } from './disburse-spender.keys';

/** 注册表列表（token 级单条注册，取 rows[0]；Spender 抽屉打开时启用）。 */
export function useSpenderListQuery(
  projectId: string,
  tokenId: number | null,
  enabled = true,
) {
  return useQuery({
    queryKey: disburseSpenderKeys.list(projectId, tokenId ?? 0),
    queryFn: ({ signal }) =>
      spenderList({ tokenId: tokenId as number }, { signal }),
    enabled: enabled && tokenId != null,
  });
}
