'use client';

/** LP 补资域 mutation hooks。成功后失效列表缓存。 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { lpTopupKeys } from './lp-topup.keys';
import { saveLpTopup } from './lp-topup.api';
import type { LpTopupSaveReq } from './lp-topup.model';

/** 声明补资（新增补资记录）。 */
export function useSaveLpTopupMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LpTopupSaveReq) => saveLpTopup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lpTopupKeys.lists(projectId) });
    },
  });
}
