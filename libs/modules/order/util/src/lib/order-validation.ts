import { z } from 'zod';

type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

const ORDER_STATUS_VALUES: OrderStatus[] = [
  'pending',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
];

/**
 * Zod schema for creating a new order.
 *
 * Enforces:
 * - customer name is required and reasonably bounded
 * - totalAmount is a positive integer (minor currency unit)
 * - optional fields have sensible max lengths
 */
export const createOrderSchema = z.object({
  customer: z
    .string()
    .min(1, '客户姓名不能为空')
    .max(100, '客户姓名过长'),
  customerEmail: z
    .string()
    .email('邮箱格式不正确')
    .optional()
    .or(z.literal('')),
  customerPhone: z
    .string()
    .max(20, '电话过长')
    .optional()
    .or(z.literal('')),
  shippingAddress: z
    .string()
    .max(500, '地址过长')
    .optional()
    .or(z.literal('')),
  totalAmount: z
    .number()
    .int('金额必须为整数')
    .positive('金额必须大于 0'),
  currency: z
    .string()
    .length(3, '货币代码必须为 3 位')
    .optional()
    .or(z.literal('')),
  status: z
    .enum(ORDER_STATUS_VALUES as [OrderStatus, ...OrderStatus[]])
    .optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, '商品 ID 不能为空'),
        productName: z.string().min(1, '商品名称不能为空'),
        quantity: z.number().int().positive('数量必须大于 0'),
        unitPrice: z.number().int().positive('单价必须大于 0'),
      })
    )
    .optional(),
});

/**
 * Zod schema for updating an existing order.
 *
 * All fields are optional because PATCH semantics allow partial updates.
 */
export const updateOrderSchema = createOrderSchema.partial();

/**
 * Zod schema for order list query parameters.
 *
 * Validates filters sent from the list page to the API.
 */
export const orderListParamsSchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  orderNo: z.string().optional(),
  customer: z.string().optional(),
  status: z
    .union([
      z.enum(ORDER_STATUS_VALUES as [OrderStatus, ...OrderStatus[]]),
      z.array(z.enum(ORDER_STATUS_VALUES as [OrderStatus, ...OrderStatus[]])),
    ])
    .optional(),
  createdAtFrom: z.string().datetime().optional(),
  createdAtTo: z.string().datetime().optional(),
  minAmount: z.number().int().nonnegative().optional(),
  maxAmount: z.number().int().nonnegative().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type OrderListParamsInput = z.infer<typeof orderListParamsSchema>;
