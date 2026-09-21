/**
 * LP Token 对参与域 query key factory（携带 projectId 隔离缓存，pool 域同模式）。
 */
export const pairKeys = {
  all: (projectId: string) => ['project', projectId, 'pair'] as const,
  /** POST /lp/pair/list 我的 token 对（单视图）。 */
  list: (projectId: string) => [...pairKeys.all(projectId), 'list'] as const,
} as const;
