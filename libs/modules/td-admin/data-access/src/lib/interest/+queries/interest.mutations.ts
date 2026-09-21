/**
 * Interest 模块 TanStack Query mutation hooks（写操作端）。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  editInterestPolicy,
  operateInterestPolicy,
  postTokenBill,
  retryTokenBill,
  saveInterestPolicy,
} from '../interest.api';
import type {
  InterestOperateParams,
  InterestRuleSaveParams,
  TokenBillPostParams,
} from '../interest.model';
import { interestKeys } from './interest.keys';

/** 创建计息策略。 */
export function useSaveInterestPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: InterestRuleSaveParams) => saveInterestPolicy(params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: interestKeys.all });
    },
  });
}

/** 编辑计息策略。 */
export function useEditInterestPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: InterestRuleSaveParams) => editInterestPolicy(params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: interestKeys.all });
    },
  });
}

/** 策略启停（Enable/Disable）。 */
export function useOperateInterest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: InterestOperateParams) => operateInterestPolicy(params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: interestKeys.all });
    },
  });
}

/** 发起交易过账。 */
export function usePostTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: TokenBillPostParams) => postTokenBill(params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: interestKeys.all });
    },
  });
}

/** 重试失败交易。 */
export function useRetryTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: TokenBillPostParams) => retryTokenBill(params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: interestKeys.all });
    },
  });
}
