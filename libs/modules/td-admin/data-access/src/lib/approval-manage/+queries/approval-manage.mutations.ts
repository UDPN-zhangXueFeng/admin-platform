'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  addTaskApproveUser,
  approvalPreviousStep,
  approvalWithdraw,
  multApprovalProcess,
} from '../approval-manage.api';
import type {
  ApproveForm,
  EscalationDrawerPayload,
  PreviousStepPayload,
  WithdrawPayload,
} from '../approval-manage.model';
import { approvalManageKeys } from './approval-manage.keys';

/**
 * Approval Management 模块写操作 mutation。
 *
 * 4 种审批操作（process / previousStep / withdraw / addTaskApproveUser）成功后
 * invalidate 对应缓存：详情 + 日志必刷（操作后状态/日志变化）；process/previousStep/
 * addTaskApproveUser 还需刷 todo 列表（任务流转出待审批）；withdraw 需刷 create 列表
 * （撤回我发起的单据）。列表 query key 含分页参数，故用前缀 invalidate 覆盖所有页。
 *
 * **process 的 transCode**：作为 mutation 变量的一部分传入（由调用方从
 * approvedDetail.businessContent.transCode 取），通过 Bus-Trace-ID header 透传，非 body。
 */

/** multApprovalProcess 的 mutation 变量（含 transCode，header 用）。 */
export interface ProcessApprovalPayload extends ApproveForm {
  transCode: string;
}

/** 通过/驳回。成功后刷详情 + 日志 + 待审批列表。 */
export function useProcessApprovalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ transCode, ...form }: ProcessApprovalPayload) =>
      multApprovalProcess(form, transCode),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: approvalManageKeys.all,
      });
    },
  });
}

/** 退回上一步。成功后刷详情 + 日志 + 待审批列表。 */
export function usePreviousStepMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PreviousStepPayload) => approvalPreviousStep(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: approvalManageKeys.all,
      });
    },
  });
}

/** 撤回（Tab3）。成功后刷我发起的列表。 */
export function useWithdrawMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: WithdrawPayload) => approvalWithdraw(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: approvalManageKeys.all,
      });
    },
  });
}

/** 升级转办（Drawer 选人）。成功后刷详情 + 日志 + 待审批列表。 */
export function useAddTaskApproveUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EscalationDrawerPayload) => addTaskApproveUser(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: approvalManageKeys.all,
      });
    },
  });
}
