/** LP 资金池 query key factory（携带 projectId 隔离缓存，kissen-admin 同模式）。 */
export const poolKeys = {
  all: (projectId: string) => ['project', projectId, 'pool'] as const,
  list: (projectId: string) => [...poolKeys.all(projectId), 'list'] as const,
} as const;
