'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createOrder, deleteOrder, updateOrder } from '../order.api';
import type { CreateOrderDTO, UpdateOrderDTO } from '../order.model';
import { orderKeys } from './order.keys';

/**
 * Hook for creating a new order.
 *
 * On success, invalidates all order lists so the new item appears.
 */
export function useCreateOrderMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOrderDTO) => createOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists(projectId) });
    },
  });
}

/**
 * Hook for updating an existing order.
 *
 * Invalidates both the specific detail and all list queries
 * so every view reflects the latest data.
 */
export function useUpdateOrderMutation(projectId: string, id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateOrderDTO) => updateOrder(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(projectId, id) });
      queryClient.invalidateQueries({ queryKey: orderKeys.lists(projectId) });
    },
  });
}

/**
 * Hook for deleting an order.
 *
 * On success, invalidates all order lists so the deleted item disappears.
 */
export function useDeleteOrderMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists(projectId) });
    },
  });
}
