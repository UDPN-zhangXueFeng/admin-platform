'use client';

/**
 * 商品管理 module read-query hooks.
 *
 * All hooks accept `projectId` as the first argument so query keys
 * stay isolated across project switches. TanStack Query owns the
 * server-state; these hooks merely bridge API calls with cache keys.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getProduct, getProducts } from '../product.api';
import type { ProductListParams } from '../product.model';
import { productKeys } from './product.keys';

export function useProductsQuery(projectId: string, params: ProductListParams) {
  return useQuery({
    queryKey: productKeys.list(projectId, params),
    queryFn: ({ signal }) => getProducts(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

export function useProductQuery(projectId: string, id: string) {
  return useQuery({
    queryKey: productKeys.detail(projectId, id),
    queryFn: ({ signal }) => getProduct(id, { signal }),
    enabled: Boolean(id),
  });
}
