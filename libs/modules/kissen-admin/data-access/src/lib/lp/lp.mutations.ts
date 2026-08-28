'use client';

/**
 * LP 域 mutation hooks。
 * 成功后失效列表缓存（状态/数据可能变化）；错误 toast 由页面层
 * onError 呈现（对齐源拦截器统一提示语义）。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { lpKeys } from './lp.keys';
import {
  lpFreezeToggle,
  lpSettleCycleSave,
  resetPortalAccount,
  saveLp,
  submitLpOnboard,
} from './lp.api';
import type { LpSaveReq } from './lp.model';

/** 新建/编辑 LP（草稿）。 */
export function useSaveLpMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LpSaveReq) => saveLp(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lpKeys.lists(projectId) });
    },
  });
}

/** 提交入网申请（进入审批中心待办）。 */
export function useSubmitLpOnboardMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lpId: number) => submitLpOnboard(lpId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lpKeys.lists(projectId) });
    },
  });
}

/** 冻结/解冻 LP（立即生效，status 20↔50，规格 R-4）。 */
export function useLpFreezeToggleMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { targetId: number; freeze: boolean }) =>
      lpFreezeToggle(vars.targetId, vars.freeze),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lpKeys.lists(projectId) });
    },
  });
}

/** 重置门户首管理员口令（OTP 一次性返回；失效账号状态缓存）。 */
export function usePortalAccountResetMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lpId: number) => resetPortalAccount(lpId),
    onSuccess: (_data, lpId) => {
      void queryClient.invalidateQueries({
        queryKey: lpKeys.portalAccount(projectId, lpId),
      });
    },
  });
}

/** 结算周期配置（生效于下一张结算单；SettleAgent cycle 页消费）。 */
export function useLpSettleCycleSaveMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { lpId: number; settleCycle: number }) =>
      lpSettleCycleSave(vars),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lpKeys.lists(projectId) });
      void queryClient.invalidateQueries({ queryKey: lpKeys.all(projectId) });
    },
  });
}
