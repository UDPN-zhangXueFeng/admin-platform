'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  getApprovedDetail,
  getCompletedList,
  getCreateList,
  getTaskApprovedDetail,
  getTodoList,
  getWorkflowUserList,
} from '../approval-manage.api';
import type {
  ApprovalListFilters,
  ApprovalListParams,
  ApprovalListResponse,
  ApprovalLog,
  ApprovalTask,
  ApprovedDetail,
  EscalationUserListParams,
  EscalationUserListResponse,
} from '../approval-manage.model';
import { approvalManageKeys } from './approval-manage.keys';

/** 分页请求参数。 */
interface Page {
  pageNum: number;
  pageSize: number;
}

// ── 三 Tab 列表（服务端分页，keepPreviousData 平滑翻页） ─────────────────────────

/** 待审批列表（Tab1，rowKey=taskId）。 */
export function useTodoListQuery(params: ApprovalListParams<ApprovalListFilters>) {
  return useQuery<ApprovalListResponse<ApprovalTask>>({
    queryKey: approvalManageKeys.todo(params),
    queryFn: () => getTodoList(params),
    placeholderData: keepPreviousData,
  });
}

/** 已审批列表（Tab2，rowKey=detailId）。 */
export function useCompletedListQuery(
  params: ApprovalListParams<ApprovalListFilters>
) {
  return useQuery<ApprovalListResponse<ApprovalTask>>({
    queryKey: approvalManageKeys.completed(params),
    queryFn: () => getCompletedList(params),
    placeholderData: keepPreviousData,
  });
}

/** 我发起的列表（Tab3，rowKey=taskId；撤回 taskStatus===5 && withdrawType===1）。 */
export function useCreateListQuery(
  params: ApprovalListParams<ApprovalListFilters>
) {
  return useQuery<ApprovalListResponse<ApprovalTask>>({
    queryKey: approvalManageKeys.create(params),
    queryFn: () => getCreateList(params),
    placeholderData: keepPreviousData,
  });
}

// ── 审批详情（dispatcher 业务载荷，enabled by id + busCode） ─────────────────────

/**
 * 审批详情。`taskId` 或 `busCode` 缺失时不发起请求。
 * dispatcher 在成功后按 busCode 派生 status 字段、注入 selectType。
 */
export function useApprovedDetailQuery(
  taskId: number | undefined,
  busCode: string | undefined,
  enabled = true
) {
  return useQuery<ApprovedDetail>({
    queryKey: approvalManageKeys.detail(taskId ?? 0, busCode ?? ''),
    queryFn: () =>
      getApprovedDetail({ taskId: taskId as number, busCode: busCode as string }),
    enabled: Boolean(taskId) && Boolean(busCode) && enabled,
  });
}

// ── 审批日志（Steps 数据源，enabled by id） ─────────────────────────────────────

/** 审批日志（taskCreateInfo + recordList + approveType + taskStatus）。 */
export function useApprovalLogQuery(
  taskId: number | undefined,
  enabled = true
) {
  return useQuery<ApprovalLog>({
    queryKey: approvalManageKeys.log(taskId ?? 0),
    queryFn: () => getTaskApprovedDetail({ taskId: taskId as number }),
    enabled: Boolean(taskId) && enabled,
  });
}

// ── 升级选人列表（workflowUserList，分页 + businessCode/tokenId） ────────────────

/**
 * 升级 Drawer 选人列表。分页用 pageNum，tokenId 来自 approvedDetail.businessContent
 * .tokenId（无则 0），keepPreviousData 平滑翻页 + 跨页 selectedRowKeys 累积去重。
 */
export function useWorkflowUserListQuery(
  params: EscalationUserListParams,
  enabled = true
) {
  return useQuery<EscalationUserListResponse>({
    queryKey: approvalManageKeys.userList(params),
    queryFn: () => getWorkflowUserList(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

// ── Page 类型重导出（mutations / 页面复用） ─────────────────────────────────────
export type { Page };
