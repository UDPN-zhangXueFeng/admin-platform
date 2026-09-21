/** Dashboard 域 query key factory（携带 projectId 隔离缓存，token 域同模式）。 */
export const dashboardKeys = {
  all: (projectId: string) => ['project', projectId, 'dashboard'] as const,
  /** GET /lp/dashboard/summary 聚合（统计卡 + 资金池 + 最近交易）。 */
  summary: (projectId: string) =>
    [...dashboardKeys.all(projectId), 'summary'] as const,
  /** GET /lp/dashboard/volume?days=N 按窗口天数分 key。 */
  volume: (days: number, projectId: string) =>
    [...dashboardKeys.all(projectId), 'volume', days] as const,
} as const;
