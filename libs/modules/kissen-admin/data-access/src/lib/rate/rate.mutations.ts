'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { rateKeys } from './rate.keys';
import { saveExchangeRate, saveRate } from './rate.api';
import type { ExchangeRateSaveReq, RateSaveReq } from './rate.model';
import { currencyPairKeys } from '../currency-pair/currency-pair.keys';

/**
 * 提交加价率变更（KRC 审批）。成功后失效变更记录列表与货币对列表
 * （加价率待生效会反映到货币对行的 pendingAction）。
 */
export function useSaveRateMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RateSaveReq) => saveRate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rateKeys.lists(projectId) });
      queryClient.invalidateQueries({
        queryKey: currencyPairKeys.lists(projectId),
      });
    },
  });
}

/**
 * 维护基础汇率（FR-R-01，立即生效）。
 * 成功后失效货币对列表（baseRate 为联查值，保存后需同步展示）。
 */
export function useSaveExchangeRateMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ExchangeRateSaveReq) => saveExchangeRate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: currencyPairKeys.lists(projectId),
      });
    },
  });
}
