'use client';

/**
 * Token 管理域 mutation hooks。成功后失效列表缓存；
 * 失败 toast 由组件层 sonner 统一出（与 lp-pool/bank 域同口径）。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  tokenAdjustMinLiquidity,
  tokenApprove,
  tokenDisable,
  tokenEnable,
  tokenReject,
} from './token.api';
import { tokenKeys } from './token.keys';
import type { TokenApproveReq, TokenRejectReq } from './token.model';

/** 审核通过（返回服务端分配 tokenNo）。 */
export function useTokenApproveMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TokenApproveReq) => tokenApprove(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tokenKeys.lists(projectId) });
    },
  });
}

/** 驳回注册（原因必填 ≤200）。 */
export function useTokenRejectMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TokenRejectReq) => tokenReject(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tokenKeys.lists(projectId) });
    },
  });
}

/** 调整最低流动性（即时生效）。 */
export function useTokenAdjustMinLiquidityMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { tokenId: number; minLiquidity: string | number }) =>
      tokenAdjustMinLiquidity(data.tokenId, data.minLiquidity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tokenKeys.lists(projectId) });
    },
  });
}

/** 停用（status 20→50）。 */
export function useTokenDisableMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tokenId: number) => tokenDisable(tokenId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tokenKeys.lists(projectId) });
    },
  });
}

/** 启用（status 50→20）。 */
export function useTokenEnableMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tokenId: number) => tokenEnable(tokenId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tokenKeys.lists(projectId) });
    },
  });
}
