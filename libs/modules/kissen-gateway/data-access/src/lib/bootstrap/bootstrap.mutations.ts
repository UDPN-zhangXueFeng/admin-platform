'use client';

/**
 * 实例引导域 mutation hooks（源 api/bootstrap.ts pushPublicKey）。
 * 推送成功后失效引导状态缓存（激活流程轮询立即拉取最新接入 key 状态）。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { pushPublicKey } from './bootstrap.api';
import { bootstrapKeys } from './bootstrap.keys';

/** 上行公钥推送（POST /public-key/push，幂等）→ 失效引导状态缓存。 */
export function usePushPublicKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => pushPublicKey(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bootstrapKeys.all });
    },
  });
}
