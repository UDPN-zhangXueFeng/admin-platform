import { apiClient, type ApiRequestConfig } from '@myorg/shared/data-access-api';
import type { PaginatedResponse } from '@myorg/shared/model';
import type {
  Order,
  OrderListParams,
  CreateOrderDTO,
  UpdateOrderDTO,
} from './order.model';

/**
 * Fetch a paginated list of orders.
 *
 * @param params - Filtering, sorting, and pagination parameters
 * @param config - Optional Axios request config (signal, headers)
 */
export function getOrders(
  params: OrderListParams,
  config?: ApiRequestConfig
): Promise<PaginatedResponse<Order>> {
  return apiClient.get('/orders', { ...config, params });
}

/**
 * Fetch a single order by ID.
 *
 * @param id - Order identifier
 * @param config - Optional Axios request config
 */
export function getOrder(id: string, config?: ApiRequestConfig): Promise<Order> {
  return apiClient.get(`/orders/${id}`, config);
}

/**
 * Create a new order.
 *
 * @param data - Order creation payload
 */
export function createOrder(data: CreateOrderDTO): Promise<Order> {
  return apiClient.post('/orders', data);
}

/**
 * Update an existing order.
 *
 * @param id - Order identifier
 * @param data - Partial update payload
 */
export function updateOrder(id: string, data: UpdateOrderDTO): Promise<Order> {
  return apiClient.patch(`/orders/${id}`, data);
}

/**
 * Delete an order.
 *
 * @param id - Order identifier
 */
export function deleteOrder(id: string): Promise<void> {
  return apiClient.delete(`/orders/${id}`);
}
