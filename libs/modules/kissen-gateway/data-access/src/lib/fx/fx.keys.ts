/** fx 域 query key factory（维度：view）。 */
export const fxKeys = {
  all: ['kissen-gateway', 'fx'] as const,
  view: () => [...fxKeys.all, 'view'] as const,
} as const;
