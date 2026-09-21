/** fx 域 query key factory（维度：view / detail）。 */
export const fxKeys = {
  all: ['kissen-gateway', 'fx'] as const,
  view: () => [...fxKeys.all, 'view'] as const,
  detail: (pairId: number) => [...fxKeys.all, 'detail', pairId] as const,
} as const;
