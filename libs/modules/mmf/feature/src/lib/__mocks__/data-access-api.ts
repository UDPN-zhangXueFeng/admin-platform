/**
 * Stub for `@myorg/shared/data-access-api` used by the feature-layer jest specs.
 *
 * batch-apply-selection.ts only references TYPES from @myorg/modules/mmf/data-access,
 * but resolving that barrel executes mmf.api.ts, which imports apiClient from
 * @myorg/shared/data-access-api. Pointing both at stubs keeps the spec free of
 * axios + next-intl's ESM build (see travel-rule-status-badge.spec notes).
 */

export type { ApiRequestConfig };
export const apiClient = {
  post: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue(undefined),
};
