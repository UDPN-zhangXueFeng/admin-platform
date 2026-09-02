/** token 域 query key factory（维度：list / detail）。 */
export const tokenKeys = {
  all: ['kissen-gateway', 'token'] as const,
  list: () => [...tokenKeys.all, 'list'] as const,
  detail: (tokenCode: string) => [...tokenKeys.all, 'detail', tokenCode] as const,
} as const;
