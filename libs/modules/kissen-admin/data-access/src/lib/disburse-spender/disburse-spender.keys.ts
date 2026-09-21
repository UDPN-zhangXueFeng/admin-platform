/** 解付 Spender 域 query key factory（携带 projectId 隔离缓存）。 */
export const disburseSpenderKeys = {
  all: (projectId: string) =>
    ['project', projectId, 'disburse-spender'] as const,
  lists: (projectId: string) =>
    [...disburseSpenderKeys.all(projectId), 'list'] as const,
  /** 列表按 tokenId 筛（token 级单条注册，抽屉维度缓存）。 */
  list: (projectId: string, tokenId: number) =>
    [...disburseSpenderKeys.lists(projectId), tokenId] as const,
} as const;
