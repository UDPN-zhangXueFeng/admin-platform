export type {
  Product,
  ProductRole,
  ProductStatus,
  CreateProductDTO,
  UpdateProductDTO,
  ProductListParams,
  ProductFilters,
} from './lib/product.model';

export {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from './lib/product.api';

export { productKeys } from './lib/+queries/product.keys';
export {
  useProductsQuery,
  useProductQuery,
} from './lib/+queries/product.queries';
export {
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
} from './lib/+queries/product.mutations';

export { useProductUiStore } from './lib/+state/product-ui.store';
