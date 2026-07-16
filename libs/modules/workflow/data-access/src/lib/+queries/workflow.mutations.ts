'use client';

/**
 * Workflow module mutation hooks.
 *
 * On success each mutation invalidates the list query-key subtree so that
 * lists auto-refresh while preserving unrelated caches (detail/business/user)。
 * 对齐 role.mutations.ts 的写法。
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createWorkflow,
  modifyWorkflowStatus,
  updateWorkflow,
} from '../workflow.api';
import type {
  WorkflowCreateReq,
  WorkflowModifyStatusReq,
  WorkflowUpdateReq,
} from '../workflow.model';
import { workflowKeys } from './workflow.keys';

/** 新建工作流。 */
export function useCreateWorkflowMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: WorkflowCreateReq) => createWorkflow(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.lists(projectId) });
    },
  });
}

/** 更新工作流（编辑节点/开关）。 */
export function useUpdateWorkflowMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: WorkflowUpdateReq) => updateWorkflow(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: workflowKeys.detail(projectId, variables.workflowId),
      });
      queryClient.invalidateQueries({ queryKey: workflowKeys.lists(projectId) });
    },
  });
}

/**
 * 启用/禁用/删除工作流。status：1=Enable / 2=Disable / 3=Delete（逻辑删）。
 */
export function useModifyWorkflowStatusMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: WorkflowModifyStatusReq) => modifyWorkflowStatus(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.lists(projectId) });
    },
  });
}
