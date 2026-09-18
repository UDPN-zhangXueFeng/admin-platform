/**
 * 商品管理 module primitive types.
 *
 * Placed in `util` so that `ui` and `util` can both import them
 * without violating module-boundary rules.
 */

/** Supported product roles. */
export type ProductRole = 'admin' | 'manager' | 'editor' | 'viewer';

/** Supported product statuses. */
export type ProductStatus = 'active' | 'inactive' | 'pending';

/** Client-side filter state — mirrors API params but is UI-owned. */
export interface ProductFilters {
  search: string;
  role: ProductRole | 'all';
  status: ProductStatus | 'all';
}
