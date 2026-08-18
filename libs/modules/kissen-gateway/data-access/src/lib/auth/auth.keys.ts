/** auth 域 query key 工厂（携带 projectId 维度隔离缓存）。 */
export const authKeys = {
  all: (projectId: string) => ['project', projectId, 'auth'] as const,
  brand: (projectId: string) => [...authKeys.all(projectId), 'brand'] as const,
} as const;
