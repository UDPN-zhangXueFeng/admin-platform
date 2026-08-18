/** LP query key factory（root 携带 kissen-gateway 维度；list 按 pairId 筛选维度区分缓存）。 */
export const lpKeys = {
  all: ['kissen-gateway', 'lp'] as const,
  lists: () => [...lpKeys.all, 'list'] as const,
  /** pairId 为空（null）表示全量列表。 */
  list: (pairId?: number) =>
    [...lpKeys.lists(), { pairId: pairId ?? null }] as const,
} as const;
