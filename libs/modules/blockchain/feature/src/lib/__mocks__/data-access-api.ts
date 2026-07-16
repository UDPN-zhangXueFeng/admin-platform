/**
 * Stub for `@myorg/shared/data-access-api` used by the feature-layer jest specs.
 *
 * node-edit-helpers.spec only references TYPES from @myorg/modules/blockchain/data-access,
 * but resolving that barrel executes blockchain.api.ts, which imports apiClient from
 * @myorg/shared/data-access-api. Pointing both at stubs keeps the spec free of
 * axios + next-intl's ESM build (see mmf feature __mocks__/data-access-api.ts).
 *
 * 对齐 mmf feature 的 __mocks__/data-access-api.ts（已验收范本）。
 */

export type { ApiRequestConfig };
export const apiClient = {
  post: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue(undefined),
};
