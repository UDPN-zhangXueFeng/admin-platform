/** LP 货币对与资金池 query key factory（携带 projectId 隔离缓存，pool 域同模式）。 */
export const pairKeys = {
  all: (projectId: string) => ['project', projectId, 'pair'] as const,
  /** POST /lp/pair/list 主表（参与清单）。 */
  list: (projectId: string) => [...pairKeys.all(projectId), 'list'] as const,
  /** POST /lp/pair-pool/list 展开行聚合。 */
  poolAgg: (projectId: string) =>
    [...pairKeys.all(projectId), 'pool-agg'] as const,
} as const;
