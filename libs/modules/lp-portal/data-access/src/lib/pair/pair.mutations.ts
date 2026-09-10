'use client';

/** 存量 KLP 参与申请 mutation；Portal 页面已下线该入口，保留兼容调用层。 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { postPairApply } from './pair.api';
import { pairKeys } from './pair.keys';

export function usePairApplyMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pairId: number) => postPairApply(pairId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pairKeys.all(projectId) });
    },
    retry: false,
  });
}
