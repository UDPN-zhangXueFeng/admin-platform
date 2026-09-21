'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { workflowKeys } from './workflow.keys';
import {
  workflowSave,
  workflowStatus,
  workflowUpdate,
} from './workflow.api';
import type { WorkflowSaveReq, WorkflowUpdateReq } from './workflow.model';

/** 新建审批流。保存后可新增业务集合与列表都可能变化。 */
export function useWorkflowSaveMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: WorkflowSaveReq) => workflowSave(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.lists(projectId) });
      queryClient.invalidateQueries({
        queryKey: workflowKeys.businesses(projectId),
      });
    },
  });
}

/** 更新审批流（变更走新版本，不影响在途审批）。 */
export function useWorkflowUpdateMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: WorkflowUpdateReq) => workflowUpdate(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: workflowKeys.detail(projectId, variables.workflowId),
      });
      queryClient.invalidateQueries({ queryKey: workflowKeys.lists(projectId) });
      queryClient.invalidateQueries({
        queryKey: workflowKeys.businesses(projectId),
      });
    },
  });
}

/** 启停审批流（1 启用 / 2 失效，同 busCode 仅一个启用版本）。 */
export function useWorkflowStatusMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { workflowId: number; status: number }) =>
      workflowStatus(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.lists(projectId) });
    },
  });
}
