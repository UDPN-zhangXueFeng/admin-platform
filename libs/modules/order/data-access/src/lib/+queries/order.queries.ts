'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getOrder, getOrders } from '../order.api';
import type { OrderListParams } from '../order.model';
import { orderKeys } from './order.keys';

/**
 * Hook for fetching a paginated, filtered order list.
 *
 * Uses `keepPreviousData` so the current page remains visible
 * while the next page is loading, eliminating UI flicker.
 */
export function useOrdersQuery(projectId: string, params: OrderListParams) {
  return useQuery({
    queryKey: orderKeys.list(projectId, params),
    queryFn: ({ signal }) => getOrders(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/**
 * Hook for fetching a single order by ID.
 *
 * Automatically disabled when `id` is falsy (avoids firing on
 * initial render before param is ready).
 */
export function useOrderQuery(projectId: string, id: string) {
  return useQuery({
    queryKey: orderKeys.detail(projectId, id),
    queryFn: ({ signal }) => getOrder(id, { signal }),
    enabled: Boolean(id),
  });
}
