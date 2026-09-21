'use client';

/**
 * Token 域 mutation hooks（源 api/token.ts refresh/submit）。
 * refresh 语义=同步申请状态后列表已刷新（源调用后重新 load 列表）；
 * submit 成功后本地落待审核，需失效列表缓存重取。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { refreshTokens, submitToken } from './token.api';
import { tokenKeys } from './token.keys';
import type { TokenSubmitReq } from './token.model';

/** 同步申请状态（POST /token/refresh）→ 失效 token 列表缓存。 */
export function useRefreshTokensMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => refreshTokens(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tokenKeys.all });
    },
  });
}

/** token 注册/驳回后重提（POST /token/submit）→ 失效 token 列表缓存。 */
export function useSubmitTokenMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TokenSubmitReq) => submitToken(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tokenKeys.all });
    },
  });
}
