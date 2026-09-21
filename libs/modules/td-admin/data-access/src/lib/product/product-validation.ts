/**
 * 商品管理 module Zod schemas.
 *
 * These schemas are consumed by react-hook-form via `@hookform/resolvers/zod`
 * and can also be reused for runtime payload validation before API calls.
 */

import { z } from 'zod';
import type { ProductRole, ProductStatus } from './product-types';

const productRoleSchema = z.enum([
  'admin',
  'manager',
  'editor',
  'viewer',
] as const satisfies readonly ProductRole[]);

const productStatusSchema = z.enum([
  'active',
  'inactive',
  'pending',
] as const satisfies readonly ProductStatus[]);

export const createProductSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  role: productRoleSchema,
  status: productStatusSchema.optional().default('active'),
});

export const updateProductSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).optional(),
  email: z.string().email('Invalid email address').optional(),
  role: productRoleSchema.optional(),
  status: productStatusSchema.optional(),
});

export type CreateProductFormValues = z.infer<typeof createProductSchema>;
export type UpdateProductFormValues = z.infer<typeof updateProductSchema>;
