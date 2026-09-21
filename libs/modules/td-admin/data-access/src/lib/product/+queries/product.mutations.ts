'use client';

/**
 * 商品管理 module mutation hooks.
 *
 * On success each mutation invalidates the minimal query-key subtree
 * so that lists auto-refresh while preserving unrelated caches.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createProduct, deleteProduct, updateProduct } from '../product.api';
import type { CreateProductDTO, UpdateProductDTO } from '../product.model';
import { productKeys } from './product.keys';

export function useCreateProductMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProductDTO) => createProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists(projectId) });
    },
  });
}

export function useUpdateProductMutation(projectId: string, id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProductDTO) => updateProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: productKeys.detail(projectId, id),
      });
      queryClient.invalidateQueries({ queryKey: productKeys.lists(projectId) });
    },
  });
}

export function useDeleteProductMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists(projectId) });
    },
  });
}
