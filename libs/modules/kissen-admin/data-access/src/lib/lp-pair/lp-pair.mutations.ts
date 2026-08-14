'use client';

/** LP 货币对域 mutation hooks。成功后失效列表缓存。 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { lpPairKeys } from './lp-pair.keys';
import {
  removeLpPair,
  saveLpPair,
  submitLpPair,
  updateLpPairStatus,
} from './lp-pair.api';
import type { LpPairSaveReq } from './lp-pair.model';

/** 新增/编辑。 */
export function useSaveLpPairMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LpPairSaveReq) => saveLpPair(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lpPairKeys.lists(projectId) });
    },
  });
}

/** 提交（进入审批）。 */
export function useSubmitLpPairMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => submitLpPair(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lpPairKeys.lists(projectId) });
    },
  });
}

/** 变更状态：停用(50)/恢复草稿(1)。 */
export function useUpdateLpPairStatusMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; targetStatus: number }) =>
      updateLpPairStatus(vars.id, vars.targetStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lpPairKeys.lists(projectId) });
    },
  });
}

/** 物理删除（仅草稿/拒绝态）。 */
export function useRemoveLpPairMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => removeLpPair(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lpPairKeys.lists(projectId) });
    },
  });
}
