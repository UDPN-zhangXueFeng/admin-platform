/**
 * LP 我的分成域 query key factory（携带 projectId 隔离缓存，pair/settle 域
 * 同模式）。detail key 携带完整查询入参：切筛选/翻页即独立缓存条目，
 * keepPreviousData 下翻页不闪空态。
 */
export const splitKeys = {
  all: (projectId: string) => ['project', projectId, 'split'] as const,
  /** POST /lp/split/list 当前生效比例（不分页全量）。 */
  ratios: (projectId: string) =>
    [...splitKeys.all(projectId), 'ratios'] as const,
  /** POST /lp/split/detail 分成明细分页（query 参与 key 身份）。 */
  detail: (projectId: string, req: unknown) =>
    [...splitKeys.all(projectId), 'detail', req] as const,
} as const;
