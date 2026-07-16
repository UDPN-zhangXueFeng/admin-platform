import type { PaginationParams } from '@myorg/shared/model';

/** Order status enum — backed by util/order-status constants. */
export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

/** Core Order entity. */
export interface Order {
  /** Unique identifier */
  id: string;
  /** Human-readable order number, e.g. ORD-20250611-001 */
  orderNo: string;
  /** Customer name or display name */
  customer: string;
  /** Total amount in the minor currency unit (e.g. cents) */
  totalAmount: number;
  /** Current lifecycle status */
  status: OrderStatus;
  /** ISO 8601 creation timestamp */
  createdAt: string;
  /** Optional: customer email for detail view */
  customerEmail?: string;
  /** Optional: customer phone */
  customerPhone?: string;
  /** Optional: shipping address */
  shippingAddress?: string;
  /** Optional: order items count */
  itemCount?: number;
  /** Optional: currency code, e.g. "CNY", "USD" */
  currency?: string;
}

/** DTO for creating a new order. */
export interface CreateOrderDTO {
  customer: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: string;
  totalAmount: number;
  currency?: string;
  status?: OrderStatus;
  items?: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
}

/** DTO for updating an existing order. */
export interface UpdateOrderDTO {
  customer?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: string;
  totalAmount?: number;
  currency?: string;
  status?: OrderStatus;
}

/** Query parameters for fetching paginated order lists. */
export interface OrderListParams extends PaginationParams {
  /** Filter by order number (partial match) */
  orderNo?: string;
  /** Filter by customer name (partial match) */
  customer?: string;
  /** Filter by one or more statuses */
  status?: OrderStatus | OrderStatus[];
  /** Filter by creation date — start (inclusive) */
  createdAtFrom?: string;
  /** Filter by creation date — end (inclusive) */
  createdAtTo?: string;
  /** Minimum total amount */
  minAmount?: number;
  /** Maximum total amount */
  maxAmount?: number;
}
