'use client';

/** LP 资金池域 mutation hooks。成功后失效列表缓存。 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { lpPoolKeys } from './lp-pool.keys';
import { saveLpPool } from './lp-pool.api';
import type { LpPoolSaveReq } from './lp-pool.model';

/** 新增/编辑资金池。 */
export function useSaveLpPoolMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LpPoolSaveReq) => saveLpPool(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lpPoolKeys.lists(projectId) });
    },
  });
}
