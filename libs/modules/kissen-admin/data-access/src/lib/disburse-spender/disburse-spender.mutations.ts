'use client';

/**
 * 解付 Spender 域 mutation hooks。成功后仅失效本域（tokenId 维度）缓存——
 * 源 drawer 内 save/status 成功只 load() 自身，抽屉关闭不刷新 Token 主列表；
 * 失败 toast 由组件层 sonner 统一出（与 token/lp-pool 域同口径）。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { spenderSave, spenderStatus } from './disburse-spender.api';
import { disburseSpenderKeys } from './disburse-spender.keys';
import type { SpenderSaveReq, SpenderStatusReq } from './disburse-spender.model';

/** 录入/轮换（tokenId 已存在即覆盖旧钥）。 */
export function useSpenderSaveMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SpenderSaveReq) => spenderSave(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: disburseSpenderKeys.lists(projectId),
      });
    },
  });
}

/** 启用/停用（disabled=true 冻结该 token 解付）。 */
export function useSpenderStatusMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SpenderStatusReq) => spenderStatus(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: disburseSpenderKeys.lists(projectId),
      });
    },
  });
}
