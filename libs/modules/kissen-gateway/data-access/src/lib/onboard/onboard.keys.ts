/** onboard query key factory（携带 projectId 隔离缓存，维度：status / bankInfo）。 */
export const onboardKeys = {
  all: (projectId: string) => ['project', projectId, 'onboard'] as const,
  status: (projectId: string) =>
    [...onboardKeys.all(projectId), 'status'] as const,
  bankInfo: (projectId: string) =>
    [...onboardKeys.all(projectId), 'bankInfo'] as const,
} as const;
