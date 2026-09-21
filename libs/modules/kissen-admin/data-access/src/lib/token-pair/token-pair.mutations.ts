'use client';

/**
 * Token 对域 mutation hooks。成功后失效列表缓存（启停/开通申请/参数变更均即时
 * 影响列表）；错误 toast 由 feature 层 useToast 处理（与 lp-pool/transaction 域既有约定一致）。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { tokenPairKeys } from './token-pair.keys';
import {
  changeTokenPair,
  disableTokenPair,
  enableTokenPair,
  saveTokenPair,
} from './token-pair.api';
import type { TokenPairChangeReq, TokenPairSaveReq } from './token-pair.model';

/** 开通申请（提交进入 KPT 审批；批量建对串行复用同一 mutation）。 */
export function useSaveTokenPairMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TokenPairSaveReq) => saveTokenPair(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tokenPairKeys.lists(projectId) });
    },
  });
}

/** 参数变更申请（KRC 审批，通过前现值继续生效）。 */
export function useChangeTokenPairMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TokenPairChangeReq) => changeTokenPair(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tokenPairKeys.lists(projectId) });
    },
  });
}

/** 启用（即时生效）。 */
export function useEnableTokenPairMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pairId: number) => enableTokenPair(pairId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tokenPairKeys.lists(projectId) });
    },
  });
}

/** 停用（即时生效；存在生效 LP 参与时后端拒绝，错误经 feature toast 透出）。 */
export function useDisableTokenPairMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pairId: number) => disableTokenPair(pairId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tokenPairKeys.lists(projectId) });
    },
  });
}

