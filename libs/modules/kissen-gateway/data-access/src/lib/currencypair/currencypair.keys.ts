/** 货币对 query key factory（root 携带 kissen-gateway 维度，与其他模块缓存隔离）。 */
export const currencypairKeys = {
  all: ['kissen-gateway', 'currencypair'] as const,
  list: () => [...currencypairKeys.all, 'list'] as const,
} as const;
