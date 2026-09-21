/** auth 域 query key 工厂（携带 projectId 维度隔离缓存）。 */
export const lpAuthKeys = {
  all: (projectId: string) => ['project', projectId, 'auth'] as const,
  /** 本地持久化会话（登录响应整体，含 menuTree）。 */
  session: (projectId: string) =>
    [...lpAuthKeys.all(projectId), 'session'] as const,
} as const;
