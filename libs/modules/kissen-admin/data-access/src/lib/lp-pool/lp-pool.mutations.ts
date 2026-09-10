'use client';

/**
 * LP 资金池域 mutation hooks。
 * save 供管理侧 KLPP 迁移入口复用，池列表页面本身仍为只读；
 * 错误 toast 由页面层 onError 呈现（对齐源拦截器统一提示语义）。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { lpPoolKeys } from './lp-pool.keys';
import { saveLpPool } from './lp-pool.api';
import type { LpPoolSaveReq } from './lp-pool.model';

/** 开通/编辑资金池（页面无入口，API 层保留）。 */
export function useSaveLpPoolMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LpPoolSaveReq) => saveLpPool(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lpPoolKeys.lists(projectId) });
    },
  });
}
