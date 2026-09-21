/**
 * Core authentication and authorization types.
 *
 * These types are intentionally UI-agnostic. The backend session shape
 * determines the fields; `Permission` follows a resource:action convention
 * (e.g. `user:read`, `order:write`) for fine-grained RBAC.
 */

/** Resource:action permission string — e.g. `user:read`, `order:delete` */
export type Permission = `${string}:${string}` | string;

/** Named role that maps to a set of {@link Permission}s on the backend */
export type Role = string;

/** Authenticated user snapshot from the session / login response */
export interface User {
  /** Unique user identifier */
  id: string;
  /** Display name (could be username, real name, or nick name) */
  name: string;
  /** Email address */
  email: string;
  /** Avatar image URL (optional) */
  avatar?: string;
  /** Active roles for the session */
  roles: Role[];
  /** Expanded permission list (flattened from roles or directly assigned) */
  permissions: Permission[];
  /** Arbitrary metadata the backend may attach to the session */
  [key: string]: unknown;
}
