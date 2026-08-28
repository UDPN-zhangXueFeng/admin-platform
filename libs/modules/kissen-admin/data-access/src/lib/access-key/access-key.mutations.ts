'use client';

/** Access-key domain mutation hooks; success invalidates the ledger cache. */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { accessKeyKeys } from './access-key.keys';
import { accessKeyGenerate, accessKeyRevoke } from './access-key.api';
import type { AccessKeyRevokeReq } from './access-key.model';

/** Generate a one-time access key for a bank. */
export function useAccessKeyGenerateMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bankId: number) => accessKeyGenerate(bankId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accessKeyKeys.lists(projectId) });
    },
  });
}

/** Revoke an active key (reason required, 1-200 chars). */
export function useAccessKeyRevokeMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AccessKeyRevokeReq) => accessKeyRevoke(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accessKeyKeys.lists(projectId) });
    },
  });
}
