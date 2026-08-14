import type { BankApprovalPageReq, BankListReq } from './bank.model';

/** bank 域 query key factory（携带 projectId 隔离缓存）。 */
export const bankKeys = {
  all: (projectId: string) => ['project', projectId, 'bank'] as const,
  lists: (projectId: string) => [...bankKeys.all(projectId), 'list'] as const,
  list: (projectId: string, params: BankListReq) =>
    [...bankKeys.lists(projectId), params] as const,
  detail: (projectId: string, bankId: number | undefined) =>
    [...bankKeys.all(projectId), 'detail', bankId ?? null] as const,
  supportedCurrencies: (projectId: string) =>
    [...bankKeys.all(projectId), 'supported-currencies'] as const,
  // 银行审批（bank 域内）
  approvalTodo: (projectId: string, params: {
    pageNum: number;
    pageSize: number;
    data: BankApprovalPageReq;
  }) => [...bankKeys.all(projectId), 'approval-todo', params] as const,
  approvalDone: (projectId: string, params: {
    pageNum: number;
    pageSize: number;
    data: BankApprovalPageReq;
  }) => [...bankKeys.all(projectId), 'approval-done', params] as const,
  approvalDetail: (projectId: string, busCode: string, taskId: number | undefined) =>
    [...bankKeys.all(projectId), 'approval-detail', busCode, taskId ?? null] as const,
} as const;
