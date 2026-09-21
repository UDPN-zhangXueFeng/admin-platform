'use client';

/** Bank domain mutation hooks; success invalidates list/detail caches. */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { bankKeys } from './bank.keys';
import { bankDisable, bankEnable, saveBank } from './bank.api';
import type { BankSaveReq } from './bank.model';

/** Create/edit bank. */
export function useSaveBankMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BankSaveReq) => saveBank(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankKeys.lists(projectId) });
    },
  });
}

/** Disable a bank (10/20 → 50); effective on gateway instances immediately. */
export function useBankDisableMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bankId: number) => bankDisable(bankId),
    onSuccess: (_data, bankId) => {
      queryClient.invalidateQueries({ queryKey: bankKeys.lists(projectId) });
      queryClient.invalidateQueries({ queryKey: bankKeys.detail(projectId, bankId) });
    },
  });
}

/** Re-enable a disabled bank (50 → 20). */
export function useBankEnableMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bankId: number) => bankEnable(bankId),
    onSuccess: (_data, bankId) => {
      queryClient.invalidateQueries({ queryKey: bankKeys.lists(projectId) });
      queryClient.invalidateQueries({ queryKey: bankKeys.detail(projectId, bankId) });
    },
  });
}
