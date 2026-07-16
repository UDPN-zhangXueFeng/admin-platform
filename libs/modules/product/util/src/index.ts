export {
  PRODUCT_PERMISSIONS,
  ALL_PRODUCT_PERMISSIONS,
  hasProductPermission,
} from './lib/product-permissions';
export type { ProductPermission } from './lib/product-permissions';

export type {
  ProductRole,
  ProductStatus,
  ProductFilters,
} from './lib/product-types';

export {
  createProductSchema,
  updateProductSchema,
} from './lib/product-validation';
export type {
  CreateProductFormValues,
  UpdateProductFormValues,
} from './lib/product-validation';
