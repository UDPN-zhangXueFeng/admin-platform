'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { approvalKeys } from './approval.keys';
import {
  getApprovalDetail,
  getApprovalDonePage,
  getApprovalTodoPage,
} from './approval.api';
import type { ApprovalListReq } from './approval.model';

/** 审批待办分页列表（翻页/筛选时保留旧数据）。 */
export function useApprovalTodoQuery(
  projectId: string,
  params: ApprovalListReq,
  enabled = true,
) {
  return useQuery({
    queryKey: approvalKeys.todoList(projectId, params),
    queryFn: ({ signal }) => getApprovalTodoPage(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** 审批已办分页列表（翻页/筛选时保留旧数据）。 */
export function useApprovalDoneQuery(
  projectId: string,
  params: ApprovalListReq,
  enabled = true,
) {
  return useQuery({
    queryKey: approvalKeys.doneList(projectId, params),
    queryFn: ({ signal }) => getApprovalDonePage(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** 审批详情（业务内容 + 可用操作能力位）。busCode/taskId 无效时不发起查询。 */
export function useApprovalDetailQuery(
  projectId: string,
  busCode: string | undefined,
  taskId: number | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: approvalKeys.detail(
      projectId,
      busCode ?? '',
      taskId ?? 0,
    ),
    queryFn: ({ signal }) =>
      getApprovalDetail(
        { busCode: busCode as string, taskId: taskId as number },
        { signal },
      ),
    enabled: enabled && !!busCode && !!taskId,
  });
}
