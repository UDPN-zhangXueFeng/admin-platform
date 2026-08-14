'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { bankKeys } from './bank.keys';
import {
  bankLimitChange,
  previousStepBankApproval,
  processBankApproval,
  saveBank,
  submitBankOnboard,
  toggleBankFreeze,
  withdrawBankApproval,
} from './bank.api';
import type {
  BankLimitChangeReq,
  BankSaveReq,
} from './bank.model';

/** 新建/编辑银行（草稿）。成功后失效银行列表缓存。 */
export function useSaveBankMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BankSaveReq) => saveBank(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bankKeys.lists(projectId) });
    },
  });
}

/** 草稿/被拒提交入网申请（status→5 待审核）。失效列表与待办。 */
export function useSubmitBankOnboardMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bankId: number) => submitBankOnboard({ bankId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bankKeys.lists(projectId) });
      void queryClient.invalidateQueries({
        queryKey: [...bankKeys.all(projectId), 'approval-todo'],
      });
    },
  });
}

/** 限额变更提交审批（KLC）。失效列表与待办。 */
export function useBankLimitChangeMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BankLimitChangeReq) => bankLimitChange(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...bankKeys.all(projectId), 'approval-todo'],
      });
    },
  });
}

/** 银行冻结/解冻（立即生效）。失效银行列表。 */
export function useToggleBankFreezeMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { bankId: number; freeze: boolean }) => toggleBankFreeze(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bankKeys.lists(projectId) });
    },
  });
}

/**
 * 银行审批处理（approve 3 通过 / 2 拒绝）。成功后失效待办/已办/详情与银行列表
 * （审批通过后银行 status 可能变更）。
 */
export function useProcessBankApprovalMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      busCode: string;
      taskId: number;
      approve: number;
      remarks?: string;
    }) => processBankApproval(data),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: [...bankKeys.all(projectId), 'approval-todo'],
      });
      void queryClient.invalidateQueries({
        queryKey: [...bankKeys.all(projectId), 'approval-done'],
      });
      void queryClient.invalidateQueries({
        queryKey: bankKeys.approvalDetail(projectId, vars.busCode, vars.taskId),
      });
      void queryClient.invalidateQueries({ queryKey: bankKeys.lists(projectId) });
    },
  });
}

/** 退回上一步。失效待办/已办/详情。 */
export function usePreviousStepBankApprovalMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { busCode: string; taskId: number; remarks: string }) =>
      previousStepBankApproval(data),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: [...bankKeys.all(projectId), 'approval-todo'],
      });
      void queryClient.invalidateQueries({
        queryKey: [...bankKeys.all(projectId), 'approval-done'],
      });
      void queryClient.invalidateQueries({
        queryKey: bankKeys.approvalDetail(projectId, vars.busCode, vars.taskId),
      });
    },
  });
}

/** 撤回（仅待审核且发起人本人）。失效待办/已办/详情与银行列表。 */
export function useWithdrawBankApprovalMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { busCode: string; taskId: number; remarks?: string }) =>
      withdrawBankApproval(data),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: [...bankKeys.all(projectId), 'approval-todo'],
      });
      void queryClient.invalidateQueries({
        queryKey: [...bankKeys.all(projectId), 'approval-done'],
      });
      void queryClient.invalidateQueries({
        queryKey: bankKeys.approvalDetail(projectId, vars.busCode, vars.taskId),
      });
      void queryClient.invalidateQueries({ queryKey: bankKeys.lists(projectId) });
    },
  });
}
