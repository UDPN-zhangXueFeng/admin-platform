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
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: bankInteractKeys.view(projectId, bankId),
      });
    },
  });
}
