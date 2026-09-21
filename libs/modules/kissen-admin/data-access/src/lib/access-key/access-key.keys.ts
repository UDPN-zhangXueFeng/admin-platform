import type { AccessKeyListFilter } from './access-key.model';

/** Access-key query key factory (project-scoped cache isolation). */
export const accessKeyKeys = {
  all: (projectId: string) => ['project', projectId, 'access-key'] as const,
  lists: (projectId: string) => [...accessKeyKeys.all(projectId), 'list'] as const,
  list: (projectId: string, filter: AccessKeyListFilter) =>
    [...accessKeyKeys.lists(projectId), filter] as const,
} as const;
