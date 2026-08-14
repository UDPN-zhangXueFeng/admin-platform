'use client';

import { useQuery } from '@tanstack/react-query';

import { workflowKeys } from './workflow.keys';
import {
  getWorkflowDetail,
  getWorkflowList,
  workflowBusinesses,
} from './workflow.api';

/** 审批流列表（按 busCode 筛选，全量返回）。 */
export function useWorkflowListQuery(
  projectId: string,
  busCode?: string,
  enabled = true,
) {
  return useQuery({
    queryKey: workflowKeys.list(projectId, busCode),
    queryFn: ({ signal }) => getWorkflowList({ busCode }, { signal }),
    enabled,
  });
}

/** 审批流详情（含步骤），workflowId 无效时不查询。 */
export function useWorkflowDetailQuery(
  projectId: string,
  workflowId: number | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: workflowKeys.detail(projectId, workflowId ?? 0),
    queryFn: ({ signal }) => getWorkflowDetail(workflowId as number, { signal }),
    enabled: enabled && workflowId != null && workflowId > 0,
  });
}

/** 可新增审批流配置的业务（保存/启停后列表会变）。 */
export function useWorkflowBusinessesQuery(
  projectId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: workflowKeys.businesses(projectId),
    queryFn: ({ signal }) => workflowBusinesses({ signal }),
    enabled,
  });
}
