'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { currencyPairKeys } from './currency-pair.keys';
import {
  disableCurrencyPair,
  enableCurrencyPair,
  saveCurrencyPair,
  toggleCurrencyPairFreeze,
} from './currency-pair.api';
import type {
  CurrencyPairIdReq,
  CurrencyPairSaveReq,
} from './currency-pair.model';

/** 新建/编辑货币对。成功后失效列表缓存（状态可能变化）。 */
export function useSaveCurrencyPairMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CurrencyPairSaveReq) => saveCurrencyPair(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: currencyPairKeys.lists(projectId),
      });
    },
  });
}

/** 提交启用审批（源 currencyPairEnable）。 */
export function useEnableCurrencyPairMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CurrencyPairIdReq) => enableCurrencyPair(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: currencyPairKeys.lists(projectId),
      });
    },
  });
}

/** 提交停用审批（源 currencyPairDisable）。 */
export function useDisableCurrencyPairMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CurrencyPairIdReq) => disableCurrencyPair(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: currencyPairKeys.lists(projectId),
      });
    },
  });
}

/** 冻结/解冻货币对（targetType=3，立即生效不走审批）。freeze true=冻结 / false=解冻。 */
export function useFreezeCurrencyPairMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { pairId: number; freeze: boolean }) =>
      toggleCurrencyPairFreeze(data.pairId, data.freeze),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: currencyPairKeys.lists(projectId),
      });
    },
  });
}
