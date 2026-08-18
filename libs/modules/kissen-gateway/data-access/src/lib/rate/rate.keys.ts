/** 汇率 query key factory（root 携带 kissen-gateway 维度；latest 按 pairId 区分缓存）。 */
export const rateKeys = {
  all: ['kissen-gateway', 'rate'] as const,
  latest: (pairId: number) => [...rateKeys.all, 'latest', pairId] as const,
} as const;
