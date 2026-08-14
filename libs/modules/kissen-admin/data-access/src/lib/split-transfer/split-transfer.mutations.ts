'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { splitTransferKeys } from './split-transfer.keys';
import { splitTransferSave } from './split-transfer.api';
import type { SplitTransferSaveReq } from './split-transfer.model';

/**
 * 发起分成划转审批（KST）。成功后失效本域列表。
 *
 * 注意：从结算单列表（status=20 行）触发时，调用方需另行失效 settle-order 列表
 * （源 index.vue 在 onSplitTransfer 成功后 `load()` 刷新结算单列表）。
 */
export function useSplitTransferSaveMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SplitTransferSaveReq) => splitTransferSave(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: splitTransferKeys.lists(projectId),
      });
    },
  });
}
