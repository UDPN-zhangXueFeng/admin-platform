'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { freezeKeys } from './freeze.keys';
import { freezeToggle } from './freeze.api';
import type { FreezeToggleReq } from './freeze.model';

/**
 * 冻结/解冻（立即生效，不走审批）。
 * 成功后失效整个 freeze 域（三类目标列表状态都可能变化），由激活列表自动刷新。
 */
export function useFreezeToggleMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: FreezeToggleReq) => freezeToggle(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: freezeKeys.all(projectId) });
    },
  });
}
