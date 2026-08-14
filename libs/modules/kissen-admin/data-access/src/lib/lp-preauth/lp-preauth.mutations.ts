'use client';

/** LP 预授权域 mutation hooks。成功后失效列表缓存。 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { lpPreauthKeys } from './lp-preauth.keys';
import { revokeLpPreauth, saveLpPreauth } from './lp-preauth.api';
import type { LpPreauthSaveReq } from './lp-preauth.model';

/** 新增/编辑预授权。 */
export function useSaveLpPreauthMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LpPreauthSaveReq) => saveLpPreauth(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: lpPreauthKeys.lists(projectId),
      });
    },
  });
}

/** 撤销预授权（仅 status=20）。 */
export function useRevokeLpPreauthMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preauthId: number) => revokeLpPreauth(preauthId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: lpPreauthKeys.lists(projectId),
      });
    },
  });
}
