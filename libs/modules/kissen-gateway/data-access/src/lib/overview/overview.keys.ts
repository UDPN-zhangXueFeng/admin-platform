/** overview 域 query key factory（维度：stats=统计窗口参数）。 */
export const overviewKeys = {
  all: ['kissen-gateway', 'overview'] as const,
  stats: () => [...overviewKeys.all, 'stats'] as const,
  statsWith: (params: unknown) => [...overviewKeys.stats(), params] as const,
} as const;
