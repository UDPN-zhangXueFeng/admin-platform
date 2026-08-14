'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { currencyKeys } from './currency.keys';
import { saveCurrency, toggleCurrencyStatus } from './currency.api';
import type { CurrencySaveReq, CurrencyToggleReq } from './currency.model';

/** 新建/编辑币种。成功后失效列表与已启用币种缓存（状态可能变化）。 */
export function useSaveCurrencyMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CurrencySaveReq) => saveCurrency(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: currencyKeys.lists(projectId) });
      queryClient.invalidateQueries({ queryKey: currencyKeys.enabled(projectId) });
    },
  });
}

/** 启停切换（服务端自动 20↔50 翻转）。 */
export function useToggleCurrencyStatusMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CurrencyToggleReq) => toggleCurrencyStatus(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: currencyKeys.lists(projectId) });
      queryClient.invalidateQueries({ queryKey: currencyKeys.enabled(projectId) });
    },
  });
}
