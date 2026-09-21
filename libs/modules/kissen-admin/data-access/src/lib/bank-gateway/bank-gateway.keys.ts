/** bank-gateway 域 query key factory（携带 projectId 隔离缓存）。 */
export const bankGatewayKeys = {
  all: (projectId: string) => ['project', projectId, 'bank-gateway'] as const,
  detail: (projectId: string, bankId: number | undefined) =>
    [...bankGatewayKeys.all(projectId), 'info', bankId ?? null] as const,
} as const;
