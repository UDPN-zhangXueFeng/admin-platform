'use client';

/**
 * LP 域 mutation hooks。
 * 成功后失效列表缓存（状态/数据可能变化）。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { lpKeys } from './lp.keys';
import { lpFreezeToggle, saveLp, submitLpOnboard } from './lp.api';
import type { LpSaveReq } from './lp.model';

/** 新建/编辑 LP（草稿）。 */
export function useSaveLpMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LpSaveReq) => saveLp(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lpKeys.lists(projectId) });
    },
  });
}

/** 提交入网申请（进入审批中心待办）。 */
export function useSubmitLpOnboardMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lpId: number) => submitLpOnboard(lpId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lpKeys.lists(projectId) });
    },
  });
}

/** 冻结/解冻 LP（立即生效，status 20↔50）。 */
export function useLpFreezeToggleMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { targetId: number; freeze: boolean }) =>
      lpFreezeToggle(vars.targetId, vars.freeze),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lpKeys.lists(projectId) });
    },
  });
}
