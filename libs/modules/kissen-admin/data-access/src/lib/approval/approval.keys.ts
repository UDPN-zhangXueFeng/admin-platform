import type { ApprovalApplyListReq, ApprovalListReq } from './approval.model';

/** 审批 query key factory（携带 projectId 隔离缓存；待办/已办/我发起/详情各自独立）。 */
export const approvalKeys = {
  all: (projectId: string) => ['project', projectId, 'approval'] as const,
  todoLists: (projectId: string) =>
    [...approvalKeys.all(projectId), 'todo'] as const,
  todoList: (projectId: string, params: ApprovalListReq) =>
    [...approvalKeys.todoLists(projectId), params] as const,
  doneLists: (projectId: string) =>
    [...approvalKeys.all(projectId), 'done'] as const,
  doneList: (projectId: string, params: ApprovalListReq) =>
    [...approvalKeys.doneLists(projectId), params] as const,
  applyLists: (projectId: string) =>
    [...approvalKeys.all(projectId), 'apply'] as const,
  applyList: (projectId: string, params: ApprovalApplyListReq) =>
    [...approvalKeys.applyLists(projectId), params] as const,
  detail: (projectId: string, busCode: string, taskId: number) =>
    [...approvalKeys.all(projectId), 'detail', busCode, taskId] as const,
  /** 业务键详情（busCode+busId；与任务键 detail 并存，键段不冲突）。 */
  businessDetail: (projectId: string, busCode: string, busId: number) =>
    [...approvalKeys.all(projectId), 'business-detail', busCode, busId] as const,
} as const;
