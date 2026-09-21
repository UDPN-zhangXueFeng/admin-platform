/** bootstrap 域 query key factory（独立免 token 实例，维度：state）。 */
export const bootstrapKeys = {
  all: ['kissen-gateway', 'bootstrap'] as const,
  state: () => [...bootstrapKeys.all, 'state'] as const,
} as const;
