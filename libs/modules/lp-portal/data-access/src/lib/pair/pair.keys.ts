/**
 * LP Token 对参与域 query key factory（携带 projectId 隔离缓存，pool 域同模式）。
 *
 * Mine 与 Eligible 双 tab 各持独立 key：任一侧 refetch/invalidate 均不影响
 * 另一侧缓存与加载态。
 */
export const pairKeys = {
  all: (projectId: string) => ['project', projectId, 'pair'] as const,
  /** POST /lp/pair/list 我的 token 对（Mine tab）。 */
  list: (projectId: string) => [...pairKeys.all(projectId), 'list'] as const,
  /** POST /lp/pair/eligible 可申请视图（Eligible tab）。 */
  eligible: (projectId: string) =>
    [...pairKeys.all(projectId), 'eligible'] as const,
} as const;
