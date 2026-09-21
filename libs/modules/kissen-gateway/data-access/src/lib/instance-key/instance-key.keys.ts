/** instance-key 域 query key factory（维度：view）。 */
export const instanceKeyKeys = {
  all: ['kissen-gateway', 'instance-key'] as const,
  view: () => [...instanceKeyKeys.all, 'view'] as const,
} as const;
