/**
 * Approval Management 模块 TanStack Query key 工厂。
 *
 * 始终通过这些助手生成 key，避免内联字符串数组导致缓存失效不一致。
 * 涵盖三 Tab 列表（todo/completed/create）+ 详情 + 审批日志 + 升级选人列表。
 */
export const approvalManageKeys = {
  all: ['approval-manage'] as const,

  // ── 三 Tab 列表（服务端分页） ──
  todo: (params: unknown) =>
    [...approvalManageKeys.all, 'todo', 'list', params] as const,
  completed: (params: unknown) =>
    [...approvalManageKeys.all, 'completed', 'list', params] as const,
  create: (params: unknown) =>
    [...approvalManageKeys.all, 'create', 'list', params] as const,

  // ── 详情（dispatcher 业务载荷，按 taskId+busCode） ──
  detail: (taskId: number, busCode: string) =>
    [...approvalManageKeys.all, 'detail', taskId, busCode] as const,

  // ── 审批日志（按 taskId） ──
  log: (taskId: number) => [...approvalManageKeys.all, 'log', taskId] as const,

  // ── 升级选人列表（workflowUserList，分页 + businessCode/tokenId） ──
  userList: (params: unknown) =>
    [...approvalManageKeys.all, 'userList', params] as const,
} as const;
