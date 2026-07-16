/**
 * TanStack Query key factory for the product module.
 *
 * Every key includes `projectId` so switching projects automatically
 * isolates cached server-state. Always use these helpers instead of
 * inline string arrays.
 */

import type { ProductListParams } from '../product.model';

export const productKeys = {
  /** Root key for all product queries within a project. */
  all: (projectId: string) => ['project', projectId, 'product'] as const,

  /** Key prefix for all list queries. */
  lists: (projectId: string) =>
    [...productKeys.all(projectId), 'list'] as const,

  /** Key for a specific paginated/filtered list. */
  list: (projectId: string, params: ProductListParams) =>
    [...productKeys.lists(projectId), params] as const,

  /** Key prefix for all detail queries. */
  details: (projectId: string) =>
    [...productKeys.all(projectId), 'detail'] as const,

  /** Key for a single product detail. */
  detail: (projectId: string, id: string) =>
    [...productKeys.details(projectId), id] as const,
};
