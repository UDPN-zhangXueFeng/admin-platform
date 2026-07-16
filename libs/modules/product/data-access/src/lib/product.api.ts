/**
 * 商品管理 module raw API layer.
 *
 * Thin wrappers around Axios that map to CRUD endpoints.
 * No caching, no UI state — just HTTP + types.
 */

import {
  apiClient,
  type ApiRequestConfig,
} from '@myorg/shared/data-access-api';
import type { PaginatedResponse } from '@myorg/shared/model';
import type {
  Product,
  ProductListParams,
  CreateProductDTO,
  UpdateProductDTO,
} from './product.model';

export function getProducts(
  params: ProductListParams,
  config?: ApiRequestConfig,
): Promise<PaginatedResponse<Product>> {
  return apiClient.get('/products', { ...config, params });
}

export function getProduct(
  id: string,
  config?: ApiRequestConfig,
): Promise<Product> {
  return apiClient.get(`/products/${id}`, config);
}

export function createProduct(data: CreateProductDTO): Promise<Product> {
  return apiClient.post('/products', data);
}

export function updateProduct(
  id: string,
  data: UpdateProductDTO,
): Promise<Product> {
  return apiClient.patch(`/products/${id}`, data);
}

export function deleteProduct(id: string): Promise<void> {
  return apiClient.delete(`/products/${id}`);
}
