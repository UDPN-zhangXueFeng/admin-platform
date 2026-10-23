'use client';

/** Bank-interact domain mutation hooks; success invalidates the peer view. */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { bankInteractKeys } from './bank-interact.keys';
import { interactSave } from './bank-interact.api';
import type { InteractSaveReq } from './bank-interact.model';

/**
 * Toggle one interact rule. Token-level toggles patch the cached peers in
 * place (callers may flip `banned` locally after success instead of refetch).
 */
export function useInteractSaveMutation(projectId: string, bankId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InteractSaveReq) => interactSave(data),
    // 成功或失败都重新拉取对端列表：保存失败时后端可能已落库（响应超时/连接中断），
    // 只在 onSuccess 失效缓存会让界面停留在旧状态，看起来像「开关没生效」。
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: bankInteractKeys.view(projectId, bankId),
      }),
  });
}
