/**
 * LP 预授权域 query key factory（携带 projectId 隔离缓存，pair 域同模式）。
 *
 * list key 携带请求体（poolId 筛选入 key）：切筛选即独立缓存条目，
 * 同参数翻回命中缓存不重发（settle 域同模式）。
 */
export const preauthKeys = {
  all: (projectId: string) => ['project', projectId, 'preauth'] as const,
  /** POST /lp/preauth/list 快照列表（req 参与 key 身份）。 */
  list: (projectId: string, req: { poolId?: number }) =>
    [...preauthKeys.all(projectId), 'list', req] as const,
} as const;
