/**
 * 商品管理 module domain model — types, DTOs, and filter shapes.
 *
 * Kept strictly decoupled from UI or networking concerns so both
 * feature pages and API layers can import without pulling React.
 */

import type { PaginationParams } from '@myorg/shared/model';
import type {
  ProductRole,
  ProductStatus,
  ProductFilters,
} from '@myorg/modules/product/util';

export type { ProductRole, ProductStatus, ProductFilters };

/** Core product entity returned by the API. */
export interface Product {
  id: string;
  name: string;
  email: string;
  role: ProductRole;
  status: ProductStatus;
  avatar?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Payload for creating a new product. */
export interface CreateProductDTO {
  name: string;
  email: string;
  role: ProductRole;
  status?: ProductStatus;
  avatar?: string;
}

/** Payload for updating an existing product. */
export interface UpdateProductDTO {
  name?: string;
  email?: string;
  role?: ProductRole;
  status?: ProductStatus;
  avatar?: string;
}

/** Query parameters sent to the paginated product list endpoint. */
export interface ProductListParams extends PaginationParams {
  /** Free-text search across name and email */
  search?: string;
  /** Filter by role */
  role?: ProductRole;
  /** Filter by status */
  status?: ProductStatus;
}
