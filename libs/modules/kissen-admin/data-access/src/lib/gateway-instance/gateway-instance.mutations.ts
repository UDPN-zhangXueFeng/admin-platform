'use client';

/**
 * 网关实例域 mutation hooks。成功后失效列表缓存；
 * 失败 toast 由组件层 sonner 统一出（与 lp-pool/bank 域同口径）。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  instanceDisable,
  instanceEnable,
  instanceRegister,
  instanceResetKey,
  instanceVerify,
} from './gateway-instance.api';
import { gatewayInstanceKeys } from './gateway-instance.keys';
import type { InstanceRegisterReq } from './gateway-instance.model';

/** 登记实例（成功后 status=1，需 verify 激活）。 */
export function useInstanceRegisterMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InstanceRegisterReq) => instanceRegister(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: gatewayInstanceKeys.lists(projectId),
      });
    },
  });
}

/** 联通验证并激活（返回下行密钥指纹回显）。 */
export function useInstanceVerifyMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (instanceId: number) => instanceVerify(instanceId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: gatewayInstanceKeys.lists(projectId),
      });
    },
  });
}

/** 重置下行密钥（返回新指纹）。 */
export function useInstanceResetKeyMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (instanceId: number) => instanceResetKey(instanceId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: gatewayInstanceKeys.lists(projectId),
      });
    },
  });
}

/** 停用（status 20→50）。 */
export function useInstanceDisableMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (instanceId: number) => instanceDisable(instanceId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: gatewayInstanceKeys.lists(projectId),
      });
    },
  });
}

/** 启用（status 50→20）。 */
export function useInstanceEnableMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (instanceId: number) => instanceEnable(instanceId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: gatewayInstanceKeys.lists(projectId),
      });
    },
  });
}
