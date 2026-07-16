/**
 * 商品管理 module permission constants and helpers.
 *
 * Centralising permission strings prevents typos that would silently
 * break PermissionGuard or usePermission checks.
 */

export const PRODUCT_PERMISSIONS = {
  READ: 'product:read',
  WRITE: 'product:write',
  DELETE: 'product:delete',
  ADMIN: 'product:admin',
} as const;

export type ProductPermission =
  | 'product:read'
  | 'product:write'
  | 'product:delete'
  | 'product:admin';

/** Convenience set for quick reference or iteration. */
export const ALL_PRODUCT_PERMISSIONS: ProductPermission[] = [
  PRODUCT_PERMISSIONS.READ,
  PRODUCT_PERMISSIONS.WRITE,
  PRODUCT_PERMISSIONS.DELETE,
  PRODUCT_PERMISSIONS.ADMIN,
];

/**
 * Check whether a permission list contains the given product permission.
 *
 * @param permissions — current user's permission set
 * @param required — permission to test
 */
export function hasProductPermission(
  permissions: string[] | undefined,
  required: ProductPermission,
): boolean {
  if (!permissions || permissions.length === 0) return false;
  return permissions.includes(required);
}
