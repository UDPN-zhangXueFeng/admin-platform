/** bank 域 query key factory（维度：detail / onboardStatus / queryList / bankInfo）。 */
export const bankKeys = {
  all: ['kissen-gateway', 'bank'] as const,
  detail: () => [...bankKeys.all, 'detail'] as const,
  onboardStatus: () => [...bankKeys.all, 'onboardStatus'] as const,
  queryList: () => [...bankKeys.all, 'queryList'] as const,
  bankInfo: () => [...bankKeys.all, 'bankInfo'] as const,
} as const;
