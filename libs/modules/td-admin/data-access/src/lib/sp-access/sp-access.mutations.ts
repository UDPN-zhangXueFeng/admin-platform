import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  auditSpAccess,
  createSpAccess,
  preflightUserWalletTxList,
  updateSpAccess,
} from './sp-access.api';
import { spAccessKeys } from './sp-access.keys';

export function useCreateSpAccessMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSpAccess,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: spAccessKeys.lists() });
    },
  });
}

export function useUpdateSpAccessMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSpAccess,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: spAccessKeys.lists() }),
        queryClient.invalidateQueries({
          // updateSpAccess 的 payload 只有 spCode（无 spId），无法定位单条 detail；
          // 失效全部 detail 缓存，update 后按需 refetch。
          queryKey: spAccessKeys.details(),
        }),
      ]);
    },
  });
}

export function useAuditSpAccessMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: auditSpAccess,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: spAccessKeys.lists() });
    },
  });
}
/**
 * Txn Details 跳转前预检（上游 UserWalletsSection.handleViewTxnDetails）：
 * 先 POST user/wallet/txList，code!==0 视为失败、不路由；成功后由调用方跳转。
 */
export function useUserWalletTxListPreflightMutation() {
  return useMutation({
    mutationFn: preflightUserWalletTxList,
  });
}
