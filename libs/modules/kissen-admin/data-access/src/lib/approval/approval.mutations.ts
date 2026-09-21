'use client';

import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';

import { approvalKeys } from './approval.keys';
import {
  approvalPreviousStep,
  approvalProcess,
  approvalWithdraw,
} from './approval.api';

/**
 * 审批操作成功后失效待办 + 已办列表（状态流转同时影响两个视图）。
 * 详情缓存不失效（业务内容不变）。
 */
function invalidateApprovalLists(
  queryClient: QueryClient,
  projectId: string,
) {
  queryClient.invalidateQueries({
    queryKey: approvalKeys.todoLists(projectId),
  });
  queryClient.invalidateQueries({
    queryKey: approvalKeys.doneLists(projectId),
  });
}

/** 审批处理：approve 3 通过 / 2 拒绝（POST /mult/approval/process）。 */
export function useApprovalProcessMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      busCode: string;
      taskId: number;
      approve: number;
      remarks?: string;
    }) => approvalProcess(data),
    onSuccess: () => invalidateApprovalLists(queryClient, projectId),
  });
}

/** 退回上一步（POST /mult/approval/previousStep；remarks 必填）。 */
export function useApprovalPreviousStepMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      busCode: string;
      taskId: number;
      remarks: string;
    }) => approvalPreviousStep(data),
    onSuccess: () => invalidateApprovalLists(queryClient, projectId),
  });
}

/** 撤回：仅待审核(5)且发起人本人（POST /mult/approval/withdraw）。 */
export function useApprovalWithdrawMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      busCode: string;
      taskId: number;
      remarks?: string;
    }) => approvalWithdraw(data),
    onSuccess: () => invalidateApprovalLists(queryClient, projectId),
  });
}
