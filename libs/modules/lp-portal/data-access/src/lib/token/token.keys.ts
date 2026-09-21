/** LP Token 总览域 query key factory（携带 projectId 隔离缓存，pair 域同模式）。 */
export const tokenKeys = {
  all: (projectId: string) => ['project', projectId, 'token'] as const,
  /** POST /lp/token/list 视图一主表。 */
  list: (projectId: string) => [...tokenKeys.all(projectId), 'list'] as const,
  /** GET /lp/token/bank-group 视图二按银行分组。 */
  bankGroup: (projectId: string) =>
    [...tokenKeys.all(projectId), 'bank-group'] as const,
} as const;
