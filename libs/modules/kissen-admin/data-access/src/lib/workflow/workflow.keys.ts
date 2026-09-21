/**
 * Workflow 域 query key factory（携带 projectId 隔离缓存）。
 */
export const workflowKeys = {
  all: (projectId: string) => ['project', projectId, 'workflow'] as const,
  lists: (projectId: string) =>
    [...workflowKeys.all(projectId), 'list'] as const,
  /** 列表按 busCode 筛选（源 pageSize 500 全量返回）。 */
  list: (projectId: string, busCode?: string) =>
    [...workflowKeys.lists(projectId), { busCode }] as const,
  detail: (projectId: string, workflowId: number) =>
    [...workflowKeys.all(projectId), 'detail', workflowId] as const,
  /** 可新增审批流的业务（保存后可能变化）。 */
  businesses: (projectId: string) =>
    [...workflowKeys.all(projectId), 'businesses'] as const,
} as const;
