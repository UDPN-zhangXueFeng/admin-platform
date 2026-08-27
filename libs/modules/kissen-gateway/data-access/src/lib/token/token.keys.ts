/** token 域 query key factory（维度：list）。 */
export const tokenKeys = {
  all: ['kissen-gateway', 'token'] as const,
  list: () => [...tokenKeys.all, 'list'] as const,
} as const;
