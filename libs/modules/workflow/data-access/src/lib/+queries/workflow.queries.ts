'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { workflowKeys } from './workflow.keys';
import {
  getBusinessList,
  getCandidateUsers,
  getWorkflowDetail,
  getWorkflowList,
} from '../workflow.api';
import type {
  CandidateUserListParams,
  WorkflowListParams,
} from '../workflow.model';

/**
 * 工作流列表查询。`keepPreviousData` 让翻页/筛选时当前结果仍可见，直到新结果返回。
 *
 * @param projectId 项目 ID（query key 隔离）。
 * @param params    筛选 + 分页参数。
 * @param enabled   可选，默认 true。
 */
export function useWorkflowListQuery(
  projectId: string,
  params: WorkflowListParams,
  enabled = true
) {
  return useQuery({
    queryKey: workflowKeys.list(projectId, params),
    queryFn: ({ signal }) => getWorkflowList(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** 工作流详情（含 nodes 数组）。workflowId 无效时不发起查询。 */
export function useWorkflowDetailQuery(
  projectId: string,
  workflowId: number | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: workflowKeys.detail(projectId, workflowId ?? 0),
    queryFn: ({ signal }) => getWorkflowDetail(workflowId as number, { signal }),
    enabled: enabled && workflowId != null && workflowId > 0,
  });
}

/** 业务功能列表（列表筛选 + edit 业务 Select 共用）。 */
export function useBusinessListQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: workflowKeys.businessList(projectId),
    queryFn: ({ signal }) => getBusinessList({ signal }),
    enabled,
  });
}

/**
 * 候选审批人列表（选人抽屉）。按 businessCode 过滤，服务端分页。
 *
 * @param projectId 项目 ID。
 * @param params    { page, data:{ businessCode, userName? } }。
 * @param enabled   选人抽屉打开且 businessCode 已选时才查询。
 */
export function useCandidateUsersQuery(
  projectId: string,
  params: CandidateUserListParams,
  enabled = true
) {
  return useQuery({
    queryKey: workflowKeys.userList(projectId, params),
    queryFn: ({ signal }) => getCandidateUsers(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}
