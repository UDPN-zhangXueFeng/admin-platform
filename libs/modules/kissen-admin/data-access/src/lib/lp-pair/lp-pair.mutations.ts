'use client';

/**
 * LP×Token 对域 mutation hooks。
 * 成功后失效列表缓存；错误 toast 由页面层 onError 呈现（对齐源拦截器统一提示语义）。
 * save/submit/remove hooks 保留 API 层一致性（页面无入口——参与由 LP 门户发起）。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { lpPairKeys } from './lp-pair.keys';
import {
  removeLpPair,
  saveLpPair,
  setLpPairSplit,
  submitLpPair,
  updateLpPairStatus,
} from './lp-pair.api';
import type { LpPairSaveReq } from './lp-pair.model';

/** 新增/编辑草稿（页面无入口，API 层保留）。 */
export function useSaveLpPairMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LpPairSaveReq) => saveLpPair(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lpPairKeys.lists(projectId) });
    },
  });
}

/** 提交 KLP 审批（页面无入口，API 层保留）。 */
export function useSubmitLpPairMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => submitLpPair(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lpPairKeys.lists(projectId) });
    },
  });
}

/** 变更状态：50 停用（仅 20）/ 1 恢复为草稿（仅 50）。 */
export function useUpdateLpPairStatusMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; targetStatus: number }) =>
      updateLpPairStatus(vars.id, vars.targetStatus),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lpPairKeys.lists(projectId) });
    },
  });
}

/** 覆盖分成设置（仅 20；0=清除覆盖回落 token 对默认分成）。 */
export function useSetLpPairSplitMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; splitRatio: string | number }) =>
      setLpPairSplit(vars),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lpPairKeys.lists(projectId) });
    },
  });
}

/** 移除（页面无入口，API 层保留）。 */
export function useRemoveLpPairMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => removeLpPair(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lpPairKeys.lists(projectId) });
    },
  });
}
