import type { BankListReq } from './bank.model';

/** Bank query key factory (project-scoped cache isolation). */
export const bankKeys = {
  all: (projectId: string) => ['project', projectId, 'bank'] as const,
  lists: (projectId: string) => [...bankKeys.all(projectId), 'list'] as const,
  list: (projectId: string, params: BankListReq) =>
    [...bankKeys.lists(projectId), params] as const,
  detail: (projectId: string, bankId: number) =>
    [...bankKeys.all(projectId), 'detail', bankId] as const,
} as const;
